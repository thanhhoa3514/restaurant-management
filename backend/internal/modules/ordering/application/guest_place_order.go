package application

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"sort"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/ordering/domain"
	"restaurant-management/internal/platform/guest"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type GuestPlaceOrderRequest struct {
	Note  string                  `json:"note"`
	Items []GuestOrderLineRequest `json:"items"`
}

type GuestOrderLineRequest struct {
	MenuItemID uuid.UUID                 `json:"menu_item_id"`
	VariantID  *uuid.UUID                `json:"variant_id"`
	Quantity   int                       `json:"quantity"`
	Note       string                    `json:"note"`
	Options    []GuestOrderOptionRequest `json:"options"`
}

type GuestOrderOptionRequest struct {
	OptionID uuid.UUID `json:"option_id"`
	Quantity int       `json:"quantity"`
}

type GuestPlaceOrderResponse struct {
	OrderID         uuid.UUID           `json:"order_id"`
	OrderNumber     string              `json:"order_number"`
	OrderType       string              `json:"order_type"`
	Items           []GuestOrderItemDTO `json:"items"`
	SessionTotalVND int64               `json:"session_total_vnd"`
}

type GuestOrderItemDTO struct {
	OrderItemID         uuid.UUID             `json:"order_item_id"`
	MenuItemID          uuid.UUID             `json:"menu_item_id"`
	NameSnapshot        string                `json:"name_snapshot"`
	VariantNameSnapshot *string               `json:"variant_name_snapshot"`
	Quantity            int                   `json:"quantity"`
	UnitPriceVND        int64                 `json:"unit_price_vnd"`
	OptionsTotalVND     int64                 `json:"options_total_vnd"`
	SubtotalVND         int64                 `json:"subtotal_vnd"`
	TotalAmountVND      int64                 `json:"total_amount_vnd"`
	Status              string                `json:"status"`
	Station             string                `json:"station"`
	Options             []GuestOrderOptionDTO `json:"options"`
}

type GuestOrderOptionDTO struct {
	NameSnapshot          string `json:"name_snapshot"`
	PriceDeltaSnapshotVND int64  `json:"price_delta_snapshot_vnd"`
	Quantity              int    `json:"quantity"`
}

type LineError struct {
	Index         int        `json:"index"`
	MenuItemID    uuid.UUID  `json:"menu_item_id"`
	Reason        string     `json:"reason"`
	OptionGroupID *uuid.UUID `json:"option_group_id,omitempty"`
}

type CartValidationError struct{ LineErrors []LineError }

func (e *CartValidationError) Error() string { return "cart validation failed" }

func (e *CartValidationError) AppError() *apperr.Error {
	return apperr.New(apperr.CodeInvalid, "cart validation failed")
}

type GuestPlaceOrder struct {
	tx                  TxRunner
	repo                domain.OrderPlacementRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewGuestPlaceOrder(tx TxRunner, repo domain.OrderPlacementRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *GuestPlaceOrder {
	return &GuestPlaceOrder{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *GuestPlaceOrder) Handle(ctx context.Context, req GuestPlaceOrderRequest) (GuestPlaceOrderResponse, error) {
	var out GuestPlaceOrderResponse
	if len(req.Items) == 0 {
		return out, apperr.New(apperr.CodeInvalid, "order must contain at least one item")
	}
	restaurantID := s.defaultRestaurantID
	gs, ok := guest.SessionFromContext(ctx)
	if !ok || gs.SessionID == uuid.Nil {
		return out, apperr.New(apperr.CodeUnauthorized, "missing guest session")
	}

	err := s.tx.Run(ctx, func(ctx context.Context) error {
		session, err := s.repo.LockSessionForOrder(ctx, restaurantID, gs.SessionID)
		if err != nil {
			return err
		}
		if session.Status != "ACTIVE" {
			return apperr.New(apperr.CodeConflict, "session is not accepting orders")
		}

		lines, lineErrors, err := s.validateLines(ctx, restaurantID, req.Items)
		if err != nil {
			return err
		}
		if len(lineErrors) > 0 {
			return &CartValidationError{LineErrors: lineErrors}
		}

		prior, err := s.repo.HasPriorOrders(ctx, restaurantID, gs.SessionID)
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
		order := &domain.OrderCreate{RestaurantID: restaurantID, SessionID: gs.SessionID, TableID: session.TableID, OrderNumber: orderNumber, OrderType: orderType, Note: req.Note, Lines: lines}
		order.KitchenTickets, err = buildKitchenTickets(lines)
		if err != nil {
			return err
		}
		if err := s.repo.CreateOrderGraph(ctx, order); err != nil {
			return err
		}
		order.SessionTotalVND, err = s.repo.SessionTotal(ctx, restaurantID, gs.SessionID)
		if err != nil {
			return err
		}
		if s.outbox != nil {
			if err := s.outbox.Write(ctx, outbox.WriteEvent{RestaurantID: restaurantID, AggregateType: "order", AggregateID: order.ID, EventType: "order.submitted", Payload: orderSubmittedPayload(order)}); err != nil {
				return err
			}
		}
		out = toPlaceResponse(order)
		return nil
	})
	return out, err
}

func (s *GuestPlaceOrder) validateLines(ctx context.Context, restaurantID uuid.UUID, reqs []GuestOrderLineRequest) ([]domain.OrderLineCreate, []LineError, error) {
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
		lineErrors = append(lineErrors, errs...)
		lines = append(lines, line)
	}
	if len(lineErrors) > 0 {
		return nil, lineErrors, nil
	}
	return lines, nil, nil
}

func validateOptionsAndBuildLine(index int, req GuestOrderLineRequest, item *domain.MenuItemForOrder, groups []domain.OptionGroupRule, options []domain.OptionForOrder, unitPrice int64, variantName *string) (domain.OrderLineCreate, []LineError) {
	errs := []LineError{}
	groupByID := map[uuid.UUID]domain.OptionGroupRule{}
	for _, g := range groups {
		groupByID[g.ID] = g
	}
	optionByID := map[uuid.UUID]domain.OptionForOrder{}
	for _, o := range options {
		optionByID[o.ID] = o
	}
	selectedByGroup := map[uuid.UUID]int{}
	lineOptions := []domain.OrderOptionCreate{}
	optionsTotal := int64(0)
	for _, optReq := range req.Options {
		opt, ok := optionByID[optReq.OptionID]
		if !ok {
			errs = append(errs, LineError{Index: index, MenuItemID: req.MenuItemID, Reason: "invalid_option"})
			continue
		}
		if _, ok := groupByID[opt.GroupID]; !ok {
			errs = append(errs, LineError{Index: index, MenuItemID: req.MenuItemID, Reason: "invalid_option"})
			continue
		}
		selectedByGroup[opt.GroupID]++
		optionsTotal += opt.PriceDeltaVND * int64(optReq.Quantity)
		lineOptions = append(lineOptions, domain.OrderOptionCreate{OptionID: opt.ID, OptionGroupID: opt.GroupID, OptionNameSnapshot: opt.Name, OptionGroupNameSnapshot: opt.GroupName, PriceDeltaSnapshotVND: opt.PriceDeltaVND, Quantity: optReq.Quantity})
	}
	for _, g := range groups {
		count := selectedByGroup[g.ID]
		if g.IsRequired && count == 0 {
			gid := g.ID
			errs = append(errs, LineError{Index: index, MenuItemID: req.MenuItemID, Reason: "missing_required_option", OptionGroupID: &gid})
			continue
		}
		if count < g.MinSelections || (g.MaxSelections != nil && count > *g.MaxSelections) || (g.SelectionType == "SINGLE" && count > 1) {
			gid := g.ID
			errs = append(errs, LineError{Index: index, MenuItemID: req.MenuItemID, Reason: "option_count_out_of_range", OptionGroupID: &gid})
		}
	}
	station := item.Station
	if station == "" {
		station = "GENERAL"
	}
	subtotal := (unitPrice + optionsTotal) * int64(req.Quantity)
	return domain.OrderLineCreate{MenuItemID: req.MenuItemID, VariantID: req.VariantID, ItemNameSnapshot: item.Name, ItemCodeSnapshot: item.Code, VariantNameSnapshot: variantName, UnitPriceVND: unitPrice, Quantity: req.Quantity, OptionsTotalVND: optionsTotal, SubtotalVND: subtotal, DiscountAmountVND: 0, TotalAmountVND: subtotal, Status: "PENDING", Station: station, Note: req.Note, Options: lineOptions}, errs
}

func buildKitchenTickets(lines []domain.OrderLineCreate) ([]domain.KitchenTicketCreate, error) {
	byStation := map[string][]int{}
	for i, line := range lines {
		station := line.Station
		if station == "" {
			station = "GENERAL"
		}
		byStation[station] = append(byStation[station], i)
	}
	stations := make([]string, 0, len(byStation))
	for station := range byStation {
		stations = append(stations, station)
	}
	sort.Strings(stations)
	tickets := make([]domain.KitchenTicketCreate, 0, len(stations))
	for _, station := range stations {
		num, err := randomNumber("TKT")
		if err != nil {
			return nil, err
		}
		tickets = append(tickets, domain.KitchenTicketCreate{TicketNumber: num, Station: station, ItemIndexes: byStation[station]})
	}
	return tickets, nil
}

func randomNumber(prefix string) (string, error) {
	b := make([]byte, 18)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return fmt.Sprintf("%s-%s", prefix, base64.RawURLEncoding.EncodeToString(b)), nil
}

func toPlaceResponse(order *domain.OrderCreate) GuestPlaceOrderResponse {
	items := make([]GuestOrderItemDTO, 0, len(order.Lines))
	for _, line := range order.Lines {
		options := make([]GuestOrderOptionDTO, 0, len(line.Options))
		for _, opt := range line.Options {
			options = append(options, GuestOrderOptionDTO{NameSnapshot: opt.OptionNameSnapshot, PriceDeltaSnapshotVND: opt.PriceDeltaSnapshotVND, Quantity: opt.Quantity})
		}
		items = append(items, GuestOrderItemDTO{OrderItemID: line.ID, MenuItemID: line.MenuItemID, NameSnapshot: line.ItemNameSnapshot, VariantNameSnapshot: line.VariantNameSnapshot, Quantity: line.Quantity, UnitPriceVND: line.UnitPriceVND, OptionsTotalVND: line.OptionsTotalVND, SubtotalVND: line.SubtotalVND, TotalAmountVND: line.TotalAmountVND, Status: line.Status, Station: line.Station, Options: options})
	}
	return GuestPlaceOrderResponse{OrderID: order.ID, OrderNumber: order.OrderNumber, OrderType: order.OrderType, Items: items, SessionTotalVND: order.SessionTotalVND}
}

func orderSubmittedPayload(order *domain.OrderCreate) map[string]any {
	items := make([]map[string]any, 0, len(order.Lines))
	for _, line := range order.Lines {
		items = append(items, map[string]any{"order_item_id": line.ID, "menu_item_id": line.MenuItemID, "name_snapshot": line.ItemNameSnapshot, "quantity": line.Quantity, "station": line.Station})
	}
	return map[string]any{"order_id": order.ID, "session_id": order.SessionID, "table_id": order.TableID, "items": items}
}
