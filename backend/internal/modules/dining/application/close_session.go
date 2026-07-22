package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type CloseSessionRequest struct {
	SessionID uuid.UUID `json:"session_id"`
	ActorID   uuid.UUID `json:"-"`
}

type CloseSessionResponse struct {
	ID     uuid.UUID `json:"id"`
	Status string    `json:"status"`
}

type CloseSession struct {
	tx                  TxRunner
	repo                domain.DiningRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewCloseSession(tx TxRunner, repo domain.DiningRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *CloseSession {
	return &CloseSession{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *CloseSession) Handle(ctx context.Context, in CloseSessionRequest) (CloseSessionResponse, error) {
	var out CloseSessionResponse
	if in.SessionID == uuid.Nil {
		return out, apperr.New(apperr.CodeInvalid, "session_id is required")
	}
	if in.ActorID == uuid.Nil {
		return out, apperr.New(apperr.CodeUnauthorized, "invalid user claim")
	}
	restaurantID := s.defaultRestaurantID
	actor := in.ActorID
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		session, closedNow, err := s.repo.CloseSession(ctx, restaurantID, in.SessionID, &actor)
		if err != nil {
			return err
		}
		if closedNow && s.outbox != nil {
			if err := s.outbox.Write(ctx, outbox.WriteEvent{
				RestaurantID:  restaurantID,
				AggregateType: "dining_session",
				AggregateID:   session.ID,
				EventType:     "dining.session_closed",
				Payload: map[string]any{
					"dining_session_id": session.ID,
					"table_id":          session.TableID,
					"closed_by":         actor,
					"reason":            "staff_closed",
				},
				Metadata: map[string]any{"actor_type": "STAFF", "action": "session.closed"},
				Priority: 4,
			}); err != nil {
				return err
			}
		}
		out = CloseSessionResponse{ID: session.ID, Status: string(session.Status)}
		return nil
	})
	return out, err
}
