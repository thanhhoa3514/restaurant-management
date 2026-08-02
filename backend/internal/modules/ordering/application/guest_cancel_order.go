package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/ordering/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type GuestCancelOrderRequest struct {
	OrderID uuid.UUID
}

type GuestCancelOrder struct {
	tx                  TxRunner
	repo                domain.OrderEditRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewGuestCancelOrder(tx TxRunner, repo domain.OrderEditRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *GuestCancelOrder {
	return &GuestCancelOrder{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *GuestCancelOrder) Handle(ctx context.Context, req GuestCancelOrderRequest) (GuestOrderMutationResponse, error) {
	var out GuestOrderMutationResponse
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
		lines, err := s.repo.LoadOrderLinesForEdit(ctx, restaurantID, gs.SessionID, req.OrderID)
		if err != nil {
			return err
		}
		lineIDs := make([]uuid.UUID, 0, len(lines))
		for _, line := range lines {
			// Already-cancelled lines are dead weight, not a reason to reject —
			// a guest who cancelled one dish earlier can still delete the order.
			if line.Status == "CANCELLED" {
				continue
			}
			if line.Status != string(domain.StatusPlaced) {
				return apperr.New(apperr.CodeConflict, "order has items already confirmed by staff")
			}
			lineIDs = append(lineIDs, line.ID)
		}
		if err := s.repo.CancelOrderLines(ctx, restaurantID, req.OrderID, lineIDs, "guest_cancel"); err != nil {
			return err
		}
		version, status, err := s.repo.FinishOrderMutation(ctx, restaurantID, req.OrderID, true, "guest_cancel")
		if err != nil {
			return err
		}
		sessionTotal, err := s.repo.SessionTotal(ctx, restaurantID, gs.SessionID)
		if err != nil {
			return err
		}
		if s.outbox != nil {
			if err := s.outbox.Write(ctx, outbox.WriteEvent{RestaurantID: restaurantID, AggregateType: "order", AggregateID: req.OrderID, EventType: "order.cancelled", Payload: map[string]any{"order_id": req.OrderID, "session_id": gs.SessionID, "version": version, "status": status, "session_total_vnd": sessionTotal}}); err != nil {
				return err
			}
		}
		out, err = (&GuestEditOrder{repo: s.repo}).response(ctx, restaurantID, gs.SessionID, req.OrderID, version, status)
		return err
	})
	return out, err
}
