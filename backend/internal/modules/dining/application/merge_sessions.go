package application

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type MergeSessionsRequest struct {
	SessionIDs []uuid.UUID `json:"session_ids" binding:"required,min=2"`
	ActorID    uuid.UUID   `json:"-"`
	Note       string      `json:"note"`
}

type MergeSessionsResponse struct {
	MergeGroupID uuid.UUID   `json:"merge_group_id"`
	SessionIDs   []uuid.UUID `json:"session_ids"`
	TableCodes   []string    `json:"table_codes"`
	MergedAt     string      `json:"merged_at"`
	Note         string      `json:"note"`
}

type MergeSessions struct {
	tx                  TxRunner
	repo                domain.DiningRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewMergeSessions(tx TxRunner, repo domain.DiningRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *MergeSessions {
	return &MergeSessions{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *MergeSessions) Handle(ctx context.Context, req MergeSessionsRequest) (MergeSessionsResponse, error) {
	var out MergeSessionsResponse
	restaurantID := s.defaultRestaurantID

	if len(req.SessionIDs) < 2 {
		return out, apperr.New(apperr.CodeInvalid, "at least 2 sessions are required to merge")
	}

	err := s.tx.Run(ctx, func(ctx context.Context) error {
		var tableCodes []string
		var sessionIDs []uuid.UUID

		for _, sessionID := range req.SessionIDs {
			session, err := s.repo.FindSessionByID(ctx, restaurantID, sessionID)
			if err != nil {
				return fmt.Errorf("session %s: %w", sessionID, err)
			}
			if session.Status != domain.SessionActive {
				return apperr.New(apperr.CodeConflict, fmt.Sprintf("session %s is not active (status: %s)", sessionID, session.Status))
			}
			if session.MergeGroupID != nil {
				return apperr.New(apperr.CodeConflict, fmt.Sprintf("session %s is already in a merge group", sessionID))
			}

			table, err := s.repo.FindTable(ctx, restaurantID, session.TableID)
			if err != nil {
				return fmt.Errorf("table for session %s: %w", sessionID, err)
			}
			tableCodes = append(tableCodes, table.Code)
			sessionIDs = append(sessionIDs, sessionID)
		}

		group := &domain.MergeGroup{
			RestaurantID: restaurantID,
			MergedBy:     &req.ActorID,
			Note:         req.Note,
			IsActive:     true,
		}
		if err := s.repo.CreateMergeGroup(ctx, group); err != nil {
			return err
		}

		for _, sessionID := range sessionIDs {
			if err := s.repo.UpdateSessionMergeGroup(ctx, sessionID, &group.ID); err != nil {
				return err
			}
		}

		if s.outbox != nil {
			if err := s.outbox.Write(ctx, outbox.WriteEvent{
				RestaurantID:  restaurantID,
				AggregateType: "merge_group",
				AggregateID:   group.ID,
				EventType:     "dining.sessions_merged",
				Payload: map[string]any{
					"merge_group_id": group.ID,
					"session_ids":    sessionIDs,
					"table_codes":    tableCodes,
					"merged_by":      req.ActorID,
					"note":           req.Note,
				},
				Metadata: map[string]any{"actor_type": "STAFF", "action": "sessions.merged"},
				Priority: 3,
			}); err != nil {
				return err
			}
		}

		out = MergeSessionsResponse{
			MergeGroupID: group.ID,
			SessionIDs:   sessionIDs,
			TableCodes:   tableCodes,
			Note:         req.Note,
		}
		return nil
	})

	return out, err
}
