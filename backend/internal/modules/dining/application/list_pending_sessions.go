package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
)

type PendingSessionDTO struct {
	SessionID    uuid.UUID `json:"session_id"`
	TableID      uuid.UUID `json:"table_id"`
	TableCode    string    `json:"table_code"`
	TableName    string    `json:"table_name"`
	CustomerName string    `json:"customer_name"`
}

type ListPendingSessions struct {
	repo                domain.DiningRepository
	defaultRestaurantID uuid.UUID
}

func NewListPendingSessions(repo domain.DiningRepository, defaultRestaurantID uuid.UUID) *ListPendingSessions {
	return &ListPendingSessions{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *ListPendingSessions) Handle(ctx context.Context) ([]PendingSessionDTO, error) {
	sessions, err := s.repo.FindSessionsPendingVerification(ctx, s.defaultRestaurantID)
	if err != nil {
		return nil, err
	}
	out := make([]PendingSessionDTO, 0, len(sessions))
	for _, session := range sessions {
		dto := PendingSessionDTO{
			SessionID:    session.ID,
			TableID:      session.TableID,
			CustomerName: session.CustomerName,
		}
		if t, err := s.repo.FindTable(ctx, s.defaultRestaurantID, session.TableID); err == nil && t != nil {
			dto.TableCode = t.Code
			dto.TableName = t.Name
		}
		out = append(out, dto)
	}
	return out, nil
}
