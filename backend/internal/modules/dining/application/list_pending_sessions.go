package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
)

type ListPendingSessions struct {
	repo                domain.DiningRepository
	defaultRestaurantID uuid.UUID
}

func NewListPendingSessions(repo domain.DiningRepository, defaultRestaurantID uuid.UUID) *ListPendingSessions {
	return &ListPendingSessions{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

// Handle now lists pending DEVICES, not sessions: each waiting phone is one row
// the waiter approves or rejects. An owner device on a still-pending session and
// an extra device on an already-active table both appear here, so the waiter has
// a single "who is waiting to join" queue.
func (s *ListPendingSessions) Handle(ctx context.Context) ([]domain.PendingDeviceDTO, error) {
	return s.repo.FindPendingDevices(ctx, s.defaultRestaurantID)
}
