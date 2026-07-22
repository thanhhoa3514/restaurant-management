package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/ordering/domain"
	"restaurant-management/internal/platform/outbox"
)

type MarkUnavailableRequest struct {
	Reason string `json:"reason"`
}

type StaffMarkUnavailable struct {
	tx                  TxRunner
	repo                StaffReadRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewStaffMarkUnavailable(tx TxRunner, repo StaffReadRepository, outboxWriter domain.OutboxWriter, defaultRestaurantID uuid.UUID) *StaffMarkUnavailable {
	return &StaffMarkUnavailable{tx: tx, repo: repo, outbox: outboxWriter, defaultRestaurantID: defaultRestaurantID}
}

func (s *StaffMarkUnavailable) Handle(ctx context.Context, itemID uuid.UUID, reason string, actorID *uuid.UUID, actorRole string) (UpdateItemStatusResponse, error) {
	actorRole = "kitchen"
	restaurantID := s.defaultRestaurantID
	var out UpdateItemStatusResponse
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		var err error
		out, err = s.repo.MarkItemUnavailable(ctx, restaurantID, itemID, reason, actorID)
		if err != nil {
			return err
		}
		if s.outbox != nil {
			return s.outbox.Write(ctx, outbox.WriteEvent{
				RestaurantID:  restaurantID,
				AggregateType: "order_item",
				AggregateID:   itemID,
				EventType:     "ordering.item_unavailable",
				Payload: map[string]any{
					"item_id": itemID,
					"status":  "UNAVAILABLE",
					"reason":  reason,
				},
			})
		}
		return nil
	})
	return out, err
}
