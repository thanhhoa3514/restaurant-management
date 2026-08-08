package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/ordering/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type GuestRequestCancelRequest struct {
	OrderID     uuid.UUID `json:"-"`
	OrderItemID uuid.UUID `json:"order_item_id"`
	Reason      string    `json:"reason"`
}

type GuestRequestCancelResponse struct {
	CancelRequestID uuid.UUID `json:"cancel_request_id"`
	OrderItemID     uuid.UUID `json:"order_item_id"`
	Status          string    `json:"status"`
}

type GuestRequestCancel struct {
	tx                  TxRunner
	repo                domain.OrderEditRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewGuestRequestCancel(tx TxRunner, repo domain.OrderEditRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *GuestRequestCancel {
	return &GuestRequestCancel{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *GuestRequestCancel) Handle(ctx context.Context, req GuestRequestCancelRequest) (GuestRequestCancelResponse, error) {
	var out GuestRequestCancelResponse
	restaurantID, gs, err := orderingContext(ctx, s.defaultRestaurantID)
	if err != nil {
		return out, err
	}
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		session, err := s.repo.LockSessionForOrder(ctx, restaurantID, gs.SessionID)
		if err != nil {
			return err
		}
		if session.Status != "ACTIVE" {
			return apperr.New(apperr.CodeConflict, "session is not accepting changes")
		}
		order, err := s.repo.LockOrderForGuest(ctx, restaurantID, gs.SessionID, req.OrderID)
		if err != nil {
			return err
		}
		if order.Status == "CANCELLED" {
			return apperr.New(apperr.CodeConflict, "order already cancelled")
		}
		line, err := s.repo.LockOrderLineForCancelRequest(ctx, restaurantID, gs.SessionID, req.OrderID, req.OrderItemID)
		if err != nil {
			return err
		}
		targetID := req.OrderItemID
		isCombo := line.ComboID != nil || line.ParentOrderItemID != nil
		if line.ParentOrderItemID != nil {
			targetID = *line.ParentOrderItemID
		}
		if isCombo {
			comboLines, err := s.repo.LoadOrderLinesForEdit(ctx, restaurantID, gs.SessionID, req.OrderID)
			if err != nil {
				return err
			}
			for _, candidate := range comboLines {
				if candidate.ID == targetID || (candidate.ParentOrderItemID != nil && *candidate.ParentOrderItemID == targetID) {
					if candidate.Status == "READY" || candidate.Status == "SERVED" || candidate.Status == "UNAVAILABLE" || candidate.Status == "CANCELLED" {
						return apperr.New(apperr.CodeConflict, "combo contains an item that can no longer be cancelled")
					}
				}
			}
		} else if line.Status != "PREPARING" {
			return apperr.New(apperr.CodeConflict, "item cannot be cancelled in current status")
		}
		exists, err := s.repo.OpenCancelRequestExists(ctx, restaurantID, targetID)
		if err != nil {
			return err
		}
		if exists {
			return apperr.New(apperr.CodeConflict, "cancel request already pending")
		}
		cr := &domain.CancelRequestCreate{OrderItemID: targetID, Reason: req.Reason, Status: "PENDING"}
		if err := s.repo.CreateCancelRequest(ctx, restaurantID, cr); err != nil {
			return err
		}
		if s.outbox != nil {
			if err := s.outbox.Write(ctx, outbox.WriteEvent{RestaurantID: restaurantID, AggregateType: "cancel_request", AggregateID: cr.ID, EventType: "cancel_request.created", Payload: map[string]any{"cancel_request_id": cr.ID, "order_item_id": targetID, "session_id": gs.SessionID}}); err != nil {
				return err
			}
		}
		out = GuestRequestCancelResponse{CancelRequestID: cr.ID, OrderItemID: targetID, Status: cr.Status}
		return nil
	})
	return out, err
}
