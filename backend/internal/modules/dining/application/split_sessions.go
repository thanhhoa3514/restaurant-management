package application

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type SplitSessionsRequest struct {
	MergeGroupID uuid.UUID `json:"merge_group_id" binding:"required"`
	ActorID      uuid.UUID `json:"-"`
}

type SplitSessionsResponse struct {
	MergeGroupID uuid.UUID   `json:"merge_group_id"`
	SessionIDs   []uuid.UUID `json:"session_ids"`
}

type SplitSessions struct {
	tx                  TxRunner
	repo                domain.DiningRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewSplitSessions(tx TxRunner, repo domain.DiningRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *SplitSessions {
	return &SplitSessions{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *SplitSessions) Handle(ctx context.Context, req SplitSessionsRequest) (SplitSessionsResponse, error) {
	var out SplitSessionsResponse
	restaurantID := s.defaultRestaurantID

	if req.MergeGroupID == uuid.Nil {
		return out, apperr.New(apperr.CodeInvalid, "merge_group_id is required")
	}

	err := s.tx.Run(ctx, func(ctx context.Context) error {
		if _, err := s.repo.FindActiveMergeGroup(ctx, restaurantID, req.MergeGroupID); err != nil {
			return err
		}

		sessions, err := s.repo.FindSessionsByMergeGroup(ctx, restaurantID, req.MergeGroupID)
		if err != nil {
			return err
		}
		if len(sessions) == 0 {
			return apperr.New(apperr.CodeNotFound, "no sessions found in merge group")
		}

		var sessionIDs []uuid.UUID
		for _, session := range sessions {
			sessionIDs = append(sessionIDs, session.ID)
			if err := s.repo.UpdateSessionMergeGroup(ctx, session.ID, nil); err != nil {
				return fmt.Errorf("clear merge group for session %s: %w", session.ID, err)
			}
		}

		if err := s.repo.DeactivateMergeGroup(ctx, restaurantID, req.MergeGroupID); err != nil {
			return err
		}

		if s.outbox != nil {
			if err := s.outbox.Write(ctx, outbox.WriteEvent{
				RestaurantID:  restaurantID,
				AggregateType: "merge_group",
				AggregateID:   req.MergeGroupID,
				EventType:     "dining.sessions_split",
				Payload: map[string]any{
					"merge_group_id": req.MergeGroupID,
					"session_ids":    sessionIDs,
					"split_by":       req.ActorID,
				},
				Metadata: map[string]any{"actor_type": "STAFF", "action": "sessions.split"},
				Priority: 3,
			}); err != nil {
				return err
			}
		}

		out = SplitSessionsResponse{
			MergeGroupID: req.MergeGroupID,
			SessionIDs:   sessionIDs,
		}
		return nil
	})

	return out, err
}
