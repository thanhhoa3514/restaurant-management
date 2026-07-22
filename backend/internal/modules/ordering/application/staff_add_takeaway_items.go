package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/ordering/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type StaffAddTakeawayItems struct {
	tx                  TxRunner
	repo                domain.OrderPlacementRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewStaffAddTakeawayItems(tx TxRunner, repo domain.OrderPlacementRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *StaffAddTakeawayItems {
	return &StaffAddTakeawayItems{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *StaffAddTakeawayItems) Handle(ctx context.Context, sessionID uuid.UUID, req StaffAddTakeawayItemsRequest, actorID uuid.UUID) (GuestPlaceOrderResponse, error) {
	var out GuestPlaceOrderResponse
	if len(req.Items) == 0 {
		return out, apperr.New(apperr.CodeInvalid, "order must contain at least one item")
	}
	restaurantID := s.defaultRestaurantID

	err := s.tx.Run(ctx, func(ctx context.Context) error {
		session, err := s.repo.LockSessionForOrder(ctx, restaurantID, sessionID)
		if err != nil {
			return err
		}
		if session.Status != "ACTIVE" {
			return apperr.New(apperr.CodeConflict, "session is not accepting orders")
		}

		lines, lineErrors, err := s.validateTakeawayLines(ctx, restaurantID, req.Items)
		if err != nil {
			return err
		}
		if len(lineErrors) > 0 {
			return &CartValidationError{LineErrors: lineErrors}
		}

		prior, err := s.repo.HasPriorOrders(ctx, restaurantID, sessionID)
		if err != nil {
			return err
		}
		orderType := "INITIAL"
		if prior {
			orderType = "ADDITIONAL"
		}
		orderNumber, err := randomNumber("ORD")
		if err != nil {
			return err
		}

		order := &domain.OrderCreate{
			RestaurantID:   restaurantID,
			SessionID:      sessionID,
			TableID:        session.TableID,
			OrderNumber:    orderNumber,
			OrderType:      orderType,
			Note:           req.Note,
			PlacedBy:       "STAFF",
			PlacedByUserID: &actorID,
			Lines:          lines,
		}
		order.KitchenTickets, err = buildKitchenTickets(lines)
		if err != nil {
			return err
		}
		if err := s.repo.CreateOrderGraph(ctx, order); err != nil {
			return err
		}
		order.SessionTotalVND, err = s.repo.SessionTotal(ctx, restaurantID, sessionID)
		if err != nil {
			return err
		}
		if s.outbox != nil {
			if err := s.outbox.Write(ctx, outbox.WriteEvent{
				RestaurantID:  restaurantID,
				AggregateType: "order",
				AggregateID:   order.ID,
				EventType:     "ordering.order_placed",
				Payload: orderSubmittedPayload(order),
				Metadata:      map[string]any{"actor_type": "STAFF", "action": "order.takeaway_items"},
				Priority:      3,
			}); err != nil {
				return err
			}
		}
		out = toPlaceResponse(order)
		return nil
	})
	return out, err
}

func (s *StaffAddTakeawayItems) validateTakeawayLines(ctx context.Context, restaurantID uuid.UUID, reqs []GuestOrderLineRequest) ([]domain.OrderLineCreate, []LineError, error) {
	lines := make([]domain.OrderLineCreate, 0, len(reqs))
	lineErrors := []LineError{}
	for i, req := range reqs {
		item, err := s.repo.FindMenuItemForOrder(ctx, restaurantID, req.MenuItemID)
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
			variant, err := s.repo.FindVariantForOrder(ctx, restaurantID, req.MenuItemID, *req.VariantID)
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

		groups, err := s.repo.ListOptionGroupRules(ctx, restaurantID, req.MenuItemID)
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
		options, err := s.repo.ListOptionsForOrder(ctx, restaurantID, req.MenuItemID, optionIDs)
		if err != nil {
			return nil, nil, err
		}
		line, errs := validateOptionsAndBuildLine(i, req, item, groups, options, unitPrice, variantName)
		// Mark all items as takeaway
		line.IsTakeaway = true
		lineErrors = append(lineErrors, errs...)
		lines = append(lines, line)
	}
	if len(lineErrors) > 0 {
		return nil, lineErrors, nil
	}
	return lines, nil, nil
}

// StaffAddTakeawayItemsRequest is the request DTO for staff adding takeaway items.
type StaffAddTakeawayItemsRequest struct {
	Items []GuestOrderLineRequest `json:"items" binding:"required"`
	Note  string                  `json:"note"`
}
