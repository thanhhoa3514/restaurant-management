package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type VerifySessionRequest struct {
	SessionID uuid.UUID `json:"-" param:"sessionId"`
	ActorID   uuid.UUID `json:"-"`
}

type VerifySessionResponse struct {
	SessionID uuid.UUID `json:"session_id"`
	Status    string    `json:"status"`
}

type StaffVerifySession struct {
	tx                  TxRunner
	repo                domain.DiningRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewStaffVerifySession(tx TxRunner, repo domain.DiningRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *StaffVerifySession {
	return &StaffVerifySession{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *StaffVerifySession) Handle(ctx context.Context, req VerifySessionRequest) (VerifySessionResponse, error) {
	var out VerifySessionResponse
	restaurantID := s.defaultRestaurantID
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		session, err := s.repo.FindSessionByID(ctx, restaurantID, req.SessionID)
		if err != nil {
			return err
		}
		if session.Status != domain.SessionPendingVerification {
			return apperr.New(apperr.CodeConflict, "session is not pending verification")
		}
		if err := s.repo.VerifySession(ctx, restaurantID, req.SessionID, &req.ActorID); err != nil {
			return err
		}
		if s.outbox != nil {
			return s.outbox.Write(ctx, outbox.WriteEvent{
				RestaurantID:  restaurantID,
				AggregateType: "dining_session",
				AggregateID:   req.SessionID,
				EventType:     "dining.session_verified",
				Payload: map[string]any{
					"session_id": req.SessionID,
					"table_id":   session.TableID,
					"status":     "ACTIVE",
				},
			})
		}
		return nil
	})
	if err != nil {
		return out, err
	}
	out = VerifySessionResponse{
		SessionID: req.SessionID,
		Status:    "ACTIVE",
	}
	return out, nil
}
