package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/ordering/domain"
	"restaurant-management/internal/platform/guest"
	"restaurant-management/internal/platform/outbox"

	"restaurant-management/internal/shared/apperr"
)

type GuestEditOrderRequest struct {
	OrderID uuid.UUID                   `json:"-"`
	Version int                         `json:"version"`
	Items   []GuestEditOrderLineRequest `json:"items"`
}

type GuestEditOrderLineRequest struct {
	OrderItemID uuid.UUID                 `json:"order_item_id"`
	Quantity    int                       `json:"quantity"`
	Note        string                    `json:"note"`
	Options     []GuestOrderOptionRequest `json:"options"`
}

type GuestOrderMutationResponse struct {
	OrderID         uuid.UUID           `json:"order_id"`
	OrderNumber     string              `json:"order_number"`
	OrderType       string              `json:"order_type"`
	Version         int                 `json:"version"`
	Status          string              `json:"status"`
	Items           []GuestOrderItemDTO `json:"items"`
	SessionTotalVND int64               `json:"session_total_vnd"`
}

type LineOperationError struct {
	Code       apperr.Code
	Message    string
	LineErrors []LineError
}

func (e *LineOperationError) Error() string { return e.Message }

type GuestEditOrder struct {
	tx                  TxRunner
	repo                domain.OrderEditRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewGuestEditOrder(tx TxRunner, repo domain.OrderEditRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *GuestEditOrder {
	return &GuestEditOrder{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *GuestEditOrder) Handle(ctx context.Context, req GuestEditOrderRequest) (GuestOrderMutationResponse, error) {
	var out GuestOrderMutationResponse
	// Empty items is valid: it means "remove every line I'm still allowed to
	// remove" (i.e. cancel my remaining PLACED lines) while leaving any
	// staff-confirmed lines untouched. This is how the guest deletes their last
	// unconfirmed dish in a mixed order — whole-order DELETE would fail there
	// because it requires every line to be PLACED.
	if req.Version <= 0 {
		return out, apperr.New(apperr.CodeInvalid, "version required")
	}
	restaurantID, gs, err := orderingContext(ctx, s.defaultRestaurantID)
	if err != nil {
		return out, err
	}
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		if err := s.lockSessionActive(ctx, restaurantID, gs.SessionID); err != nil {
			return err
		}
		order, err := s.repo.LockOrderForGuest(ctx, restaurantID, gs.SessionID, req.OrderID)
		if err != nil {
			return err
		}
		if order.Status == "CANCELLED" {
			return apperr.New(apperr.CodeConflict, "order already cancelled")
		}
		if req.Version != order.Version {
			return apperr.New(apperr.CodeConflict, "order was modified, reload")
		}
		lines, err := s.repo.LoadOrderLinesForEdit(ctx, restaurantID, gs.SessionID, req.OrderID)
		if err != nil {
			return err
		}
		lineIDs := make([]uuid.UUID, 0, len(lines))
		byID := map[uuid.UUID]domain.OrderLineForEdit{}

		for _, line := range lines {
			lineIDs = append(lineIDs, line.ID)
			byID[line.ID] = line
		}

		currentOptions, err := s.repo.LoadOrderLineOptionsForEdit(ctx, restaurantID, lineIDs)
		if err != nil {
			return err
		}
		payload := map[uuid.UUID]GuestEditOrderLineRequest{}
		payloadIndex := map[uuid.UUID]int{}
		for i, item := range req.Items {
			if _, ok := byID[item.OrderItemID]; !ok {
				return apperr.New(apperr.CodeNotFound, "order item not found")
			}
			payload[item.OrderItemID] = item
			payloadIndex[item.OrderItemID] = i
		}

		lineErrors := []LineError{}
		lineErrorCode := apperr.CodeInvalid
		cancelIDs := []uuid.UUID{}
		changedIDs := []uuid.UUID{}
		for _, current := range lines {
			edit, present := payload[current.ID]
			// PLACED is the only guest-editable state. Once serving staff
			// confirms the line it moves to PENDING and becomes immutable to
			// the guest.
			if current.Status != string(domain.StatusPlaced) {
				if present {
					reason := "line_locked"
					if current.Status == "CANCELLED" {
						reason = "line_already_cancelled"
					}
					lineErrors = append(lineErrors, LineError{Index: payloadIndex[current.ID], MenuItemID: current.MenuItemID, Reason: reason})
					lineErrorCode = apperr.CodeConflict
				}
				continue
			}
			if !present {
				cancelIDs = append(cancelIDs, current.ID)
				changedIDs = append(changedIDs, current.ID)
				continue
			}
			updated, errs, err := s.rebuildEditedLine(ctx, restaurantID, current, currentOptions[current.ID], edit, payloadIndex[current.ID])
			if err != nil {
				return err
			}
			lineErrors = append(lineErrors, errs...)
			if len(errs) == 0 {
				if err := s.repo.UpdateOrderLine(ctx, restaurantID, updated); err != nil {
					return err
				}
				changedIDs = append(changedIDs, current.ID)
			}
		}
		if len(lineErrors) > 0 {
			message := "cart validation failed"
			if lineErrorCode == apperr.CodeConflict {
				message = "line edit failed"
			}
			return &LineOperationError{Code: lineErrorCode, Message: message, LineErrors: lineErrors}
		}
		if len(cancelIDs) > 0 {
			if err := s.repo.CancelOrderLines(ctx, restaurantID, req.OrderID, cancelIDs, "guest_edit"); err != nil {
				return err
			}
		}
		version, status, err := s.repo.FinishOrderMutation(ctx, restaurantID, req.OrderID, true, "guest_edit")
		if err != nil {
			return err
		}
		sessionTotal, err := s.repo.SessionTotal(ctx, restaurantID, gs.SessionID)
		if err != nil {
			return err
		}
		if s.outbox != nil {
			if err := s.outbox.Write(ctx, outbox.WriteEvent{RestaurantID: restaurantID, AggregateType: "order", AggregateID: req.OrderID, EventType: "order.updated", Payload: map[string]any{"order_id": req.OrderID, "session_id": gs.SessionID, "changed_line_ids": changedIDs, "version": version, "status": status, "session_total_vnd": sessionTotal}}); err != nil {
				return err
			}
		}
		out, err = s.response(ctx, restaurantID, gs.SessionID, req.OrderID, version, status)
		return err
	})
	return out, err
}

func (s *GuestEditOrder) lockSessionActive(ctx context.Context, restaurantID, sessionID uuid.UUID) error {
	session, err := s.repo.LockSessionForOrder(ctx, restaurantID, sessionID)
	if err != nil {
		return err
	}
	if session.Status != "ACTIVE" {
		return apperr.New(apperr.CodeConflict, "session is not accepting changes")
	}
	return nil
}

func (s *GuestEditOrder) rebuildEditedLine(ctx context.Context, restaurantID uuid.UUID, current domain.OrderLineForEdit, currentOptions []domain.OrderLineOptionForEdit, edit GuestEditOrderLineRequest, index int) (domain.OrderLineCreate, []LineError, error) {
	item, err := s.repo.FindMenuItemForOrder(ctx, restaurantID, current.MenuItemID)
	if err != nil {
		return domain.OrderLineCreate{}, nil, err
	}
	if edit.Quantity <= 0 {
		return domain.OrderLineCreate{}, []LineError{{Index: index, MenuItemID: current.MenuItemID, Reason: "invalid_quantity"}}, nil
	}
	increasing := edit.Quantity > current.Quantity || hasOptionIncrease(currentOptions, edit.Options)
	if increasing && !item.Orderable {
		return domain.OrderLineCreate{}, []LineError{{Index: index, MenuItemID: current.MenuItemID, Reason: "unavailable"}}, nil
	}
	unitPrice := item.BasePriceVND
	variantName := current.VariantNameSnapshot
	if current.VariantID != nil {
		if !increasing {
			if current.UnitPriceVND > 0 {
				unitPrice = current.UnitPriceVND
			}
		} else {
			variant, err := s.repo.FindVariantForOrder(ctx, restaurantID, current.MenuItemID, *current.VariantID)
			if err != nil {
				return domain.OrderLineCreate{}, []LineError{{Index: index, MenuItemID: current.MenuItemID, Reason: "invalid_variant"}}, nil
			}
			unitPrice = variant.PriceVND
			name := variant.Name
			variantName = &name
		}
	}
	groups, err := s.repo.ListOptionGroupRules(ctx, restaurantID, current.MenuItemID)
	if err != nil {
		return domain.OrderLineCreate{}, nil, err
	}
	optionIDs := make([]uuid.UUID, 0, len(edit.Options))
	for _, opt := range edit.Options {
		optionIDs = append(optionIDs, opt.OptionID)
	}
	options, err := s.repo.ListOptionsForOrder(ctx, restaurantID, current.MenuItemID, optionIDs)
	if err != nil {
		return domain.OrderLineCreate{}, nil, err
	}
	if !increasing {
		options = append(options, reusableSnapshotOptions(currentOptions, edit.Options, options)...)
	}
	lineReq := GuestOrderLineRequest{MenuItemID: current.MenuItemID, VariantID: current.VariantID, Quantity: edit.Quantity, Note: edit.Note, Options: edit.Options}
	line, errs := validateOptionsAndBuildLine(index, lineReq, item, groups, options, unitPrice, variantName)
	line.ID = current.ID
	return line, errs, nil
}

func hasOptionIncrease(current []domain.OrderLineOptionForEdit, desired []GuestOrderOptionRequest) bool {
	quantities := map[uuid.UUID]int{}
	for _, opt := range current {
		quantities[opt.OptionID] = opt.Quantity
	}
	for _, opt := range desired {
		currentQty, ok := quantities[opt.OptionID]
		if !ok || opt.Quantity > currentQty {
			return true
		}
	}
	return false
}

func reusableSnapshotOptions(current []domain.OrderLineOptionForEdit, desired []GuestOrderOptionRequest, available []domain.OptionForOrder) []domain.OptionForOrder {
	availableIDs := map[uuid.UUID]struct{}{}
	for _, opt := range available {
		availableIDs[opt.ID] = struct{}{}
	}
	desiredIDs := map[uuid.UUID]struct{}{}
	for _, opt := range desired {
		desiredIDs[opt.OptionID] = struct{}{}
	}
	out := []domain.OptionForOrder{}
	for _, opt := range current {
		if _, ok := desiredIDs[opt.OptionID]; !ok {
			continue
		}
		if _, ok := availableIDs[opt.OptionID]; ok {
			continue
		}
		out = append(out, domain.OptionForOrder{ID: opt.OptionID, GroupID: opt.OptionGroupID, Name: opt.OptionNameSnapshot, GroupName: opt.OptionGroupNameSnapshot, PriceDeltaVND: opt.PriceDeltaSnapshotVND})
	}
	return out
}

func (s *GuestEditOrder) response(ctx context.Context, restaurantID, sessionID, orderID uuid.UUID, version int, status string) (GuestOrderMutationResponse, error) {
	view, err := s.repo.ViewSessionOrders(ctx, restaurantID, sessionID)
	if err != nil {
		return GuestOrderMutationResponse{}, err
	}
	for _, order := range view.Orders {
		if order.ID == orderID {
			return mutationResponseFromOrder(order, version, status, view.SessionTotalVND), nil
		}
	}
	return GuestOrderMutationResponse{}, apperr.New(apperr.CodeNotFound, "order not found")
}

func mutationResponseFromOrder(order domain.OrderRead, version int, status string, total int64) GuestOrderMutationResponse {
	items := make([]GuestOrderItemDTO, 0, len(order.Items))
	for _, item := range order.Items {
		options := make([]GuestOrderOptionDTO, 0, len(item.Options))
		for _, opt := range item.Options {
			options = append(options, GuestOrderOptionDTO{OptionID: opt.OptionID, OptionGroupID: opt.OptionGroupID, NameSnapshot: opt.NameSnapshot, PriceDeltaSnapshotVND: opt.PriceDeltaSnapshotVND, Quantity: opt.Quantity})
		}
		items = append(items, GuestOrderItemDTO{OrderItemID: item.ID, MenuItemID: item.MenuItemID, NameSnapshot: item.NameSnapshot, VariantNameSnapshot: item.VariantNameSnapshot, Quantity: item.Quantity, UnitPriceVND: item.UnitPriceVND, OptionsTotalVND: item.OptionsTotalVND, SubtotalVND: item.SubtotalVND, TotalAmountVND: item.TotalAmountVND, Status: item.Status, Station: item.Station, Options: options, UnavailableReason: item.UnavailableReason})
	}
	if version == 0 {
		version = order.Version
	}
	if status == "" {
		status = order.Status
	}
	return GuestOrderMutationResponse{OrderID: order.ID, OrderNumber: order.OrderNumber, OrderType: order.OrderType, Version: version, Status: status, Items: items, SessionTotalVND: total}
}

func orderingContext(ctx context.Context, defaultRestaurantID uuid.UUID) (uuid.UUID, guest.Session, error) {
	gs, ok := guest.SessionFromContext(ctx)
	if !ok || gs.SessionID == uuid.Nil {
		return uuid.Nil, guest.Session{}, apperr.New(apperr.CodeUnauthorized, "missing guest session")
	}
	return defaultRestaurantID, gs, nil
}
