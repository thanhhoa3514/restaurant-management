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
	tx     TxRunner
	repo   domain.OrderEditRepository
	outbox domain.OutboxWriter
}

func NewGuestRequestCancel(tx TxRunner, repo domain.OrderEditRepository, outbox domain.OutboxWriter) *GuestRequestCancel {
	return &GuestRequestCancel{tx: tx, repo: repo, outbox: outbox}
}

func (s *GuestRequestCancel) Handle(ctx context.Context, req GuestRequestCancelRequest) (GuestRequestCancelResponse, error) {
	var out GuestRequestCancelResponse
	restaurantID, gs, err := orderingContext(ctx)
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
		switch line.Status {
		case "PREPARING":
			// eligible below
		case "PENDING":
			return apperr.New(apperr.CodeConflict, "use PUT to edit pending items")
		case "READY", "SERVED":
			return apperr.New(apperr.CodeConflict, "item already prepared")
		default:
			return apperr.New(apperr.CodeConflict, "item cannot be cancelled")
		}
		exists, err := s.repo.OpenCancelRequestExists(ctx, restaurantID, req.OrderItemID)
		if err != nil {
			return err
		}
		if exists {
			return apperr.New(apperr.CodeConflict, "cancel request already pending")
		}
		cr := &domain.CancelRequestCreate{OrderItemID: req.OrderItemID, Reason: req.Reason, Status: "PENDING"}
		if err := s.repo.CreateCancelRequest(ctx, restaurantID, cr); err != nil {
			return err
		}
		if s.outbox != nil {
			if err := s.outbox.Write(ctx, outbox.WriteEvent{RestaurantID: restaurantID, AggregateType: "cancel_request", AggregateID: cr.ID, EventType: "cancel_request.created", Payload: map[string]any{"cancel_request_id": cr.ID, "order_item_id": req.OrderItemID, "session_id": gs.SessionID}}); err != nil {
				return err
			}
		}
		out = GuestRequestCancelResponse{CancelRequestID: cr.ID, OrderItemID: req.OrderItemID, Status: cr.Status}
		return nil
	})
	return out, err
}
