package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/ordering/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type StaffTakeawayOrderRequest struct {
	Items        []GuestOrderLineRequest `json:"items" binding:"required"`
	CustomerName string                  `json:"customer_name"`
	CustomerPhone string                 `json:"customer_phone"`
	PickupTime   *time.Time              `json:"pickup_time,omitempty"`
	Note         string                  `json:"note"`
}

type StaffTakeawayOrderResponse struct {
	OrderID     uuid.UUID           `json:"order_id"`
	OrderNumber string              `json:"order_number"`
	OrderType   string              `json:"order_type"`
	Items       []GuestOrderItemDTO `json:"items"`
	TotalVND    int64               `json:"total_vnd"`
}

type StaffTakeawayOrder struct {
	tx                  TxRunner
	repo                domain.OrderPlacementRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewStaffTakeawayOrder(tx TxRunner, repo domain.OrderPlacementRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *StaffTakeawayOrder {
	return &StaffTakeawayOrder{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *StaffTakeawayOrder) Handle(ctx context.Context, req StaffTakeawayOrderRequest, actorID uuid.UUID) (StaffTakeawayOrderResponse, error) {
	var out StaffTakeawayOrderResponse
	restaurantID := s.defaultRestaurantID

	if len(req.Items) == 0 {
		return out, apperr.New(apperr.CodeInvalid, "order must contain at least one item")
	}
	if req.CustomerName == "" {
		return out, apperr.New(apperr.CodeInvalid, "customer_name is required for takeaway orders")
	}

	err := s.tx.Run(ctx, func(ctx context.Context) error {
		lines, lineErrors, err := validateTakeawayLines(ctx, s.repo, restaurantID, req.Items)
		if err != nil {
			return err
		}
		if len(lineErrors) > 0 {
			return &CartValidationError{LineErrors: lineErrors}
		}

		orderNumber, err := randomNumber("TA")
		if err != nil {
			return err
		}

		order := &domain.OrderCreate{
			RestaurantID:   restaurantID,
			OrderNumber:    orderNumber,
			OrderType:      "TAKEAWAY",
			Note:           req.Note,
			PlacedBy:       "STAFF",
			PlacedByUserID: &actorID,
			CustomerName:   req.CustomerName,
			CustomerPhone:  req.CustomerPhone,
			PickupTime:     req.PickupTime,
			Lines:          lines,
		}
		order.KitchenTickets, err = buildKitchenTickets(lines)
		if err != nil {
			return err
		}
		if err := s.repo.CreateOrderGraph(ctx, order); err != nil {
			return err
		}

		var totalVND int64
		for _, line := range order.Lines {
			totalVND += line.TotalAmountVND
		}

		if s.outbox != nil {
			if err := s.outbox.Write(ctx, outbox.WriteEvent{
				RestaurantID:  restaurantID,
				AggregateType: "order",
				AggregateID:   order.ID,
				EventType:     "order.submitted",
				Payload: map[string]any{
					"order_id":      order.ID,
					"order_type":    "TAKEAWAY",
					"customer_name": req.CustomerName,
					"items":         orderSubmittedPayload(order)["items"],
				},
				Metadata: map[string]any{"actor_type": "STAFF", "action": "order.takeaway"},
				Priority: 3,
			}); err != nil {
				return err
			}
		}

		items := make([]GuestOrderItemDTO, 0, len(order.Lines))
		for _, line := range order.Lines {
			items = append(items, GuestOrderItemDTO{
				OrderItemID:    line.ID,
				MenuItemID:     line.MenuItemID,
				NameSnapshot:   line.ItemNameSnapshot,
				Quantity:       line.Quantity,
				UnitPriceVND:   line.UnitPriceVND,
				OptionsTotalVND: line.OptionsTotalVND,
				SubtotalVND:    line.SubtotalVND,
				TotalAmountVND: line.TotalAmountVND,
				Status:         line.Status,
				Station:        line.Station,
				IsTakeaway:     true,
			})
		}
		out = StaffTakeawayOrderResponse{OrderID: order.ID, OrderNumber: order.OrderNumber, OrderType: "TAKEAWAY", Items: items, TotalVND: totalVND}
		return nil
	})
	return out, err
}

// validateTakeawayLines validates order lines for takeaway, reusing the same
// validation logic but without the session dependency.
func validateTakeawayLines(ctx context.Context, repo domain.OrderPlacementRepository, restaurantID uuid.UUID, reqs []GuestOrderLineRequest) ([]domain.OrderLineCreate, []LineError, error) {
	lines := make([]domain.OrderLineCreate, 0, len(reqs))
	lineErrors := []LineError{}
	for i, req := range reqs {
		item, err := repo.FindMenuItemForOrder(ctx, restaurantID, req.MenuItemID)
		if err != nil {
			if apperr.Is(err, apperr.CodeNotFound) {
				lineErrors = append(lineErrors, LineError{Index: i, MenuItemID: req.MenuItemID, Reason: "menu_item_not_found"})
				continue
			}
			return nil, nil, err
		}
		if req.Quantity <= 0 {
			lineErrors = append(lineErrors, LineError{Index: i, MenuItemID: req.MenuItemID, Reason: "invalid_quantity"})
		}
		if !item.Orderable {
			lineErrors = append(lineErrors, LineError{Index: i, MenuItemID: req.MenuItemID, Reason: "unavailable"})
			continue
		}

		unitPrice := item.BasePriceVND
		var variantName *string
		if req.VariantID != nil {
			variant, err := repo.FindVariantForOrder(ctx, restaurantID, req.MenuItemID, *req.VariantID)
			if err != nil {
				if apperr.Is(err, apperr.CodeNotFound) {
					lineErrors = append(lineErrors, LineError{Index: i, MenuItemID: req.MenuItemID, Reason: "invalid_variant"})
					continue
				}
				return nil, nil, err
			}
			unitPrice = variant.PriceVND
			name := variant.Name
			variantName = &name
		}

		groups, err := repo.ListOptionGroupRules(ctx, restaurantID, req.MenuItemID)
		if err != nil {
			return nil, nil, err
		}
		optionIDs := make([]uuid.UUID, 0, len(req.Options))
		for _, optReq := range req.Options {
			if optReq.Quantity <= 0 {
				lineErrors = append(lineErrors, LineError{Index: i, MenuItemID: req.MenuItemID, Reason: "invalid_quantity"})
			}
			optionIDs = append(optionIDs, optReq.OptionID)
		}
		options, err := repo.ListOptionsForOrder(ctx, restaurantID, req.MenuItemID, optionIDs)
		if err != nil {
			return nil, nil, err
		}
		line, errs := validateOptionsAndBuildLine(i, req, item, groups, options, unitPrice, variantName)
		lineErrors = append(lineErrors, errs...)
		lines = append(lines, line)
	}
	if len(lineErrors) > 0 {
		return nil, lineErrors, nil
	}
	return lines, nil, nil
}
