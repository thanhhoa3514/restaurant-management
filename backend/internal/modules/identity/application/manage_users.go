package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/identity/domain"
	"restaurant-management/internal/shared/apperr"
)

type ManageUsersRequest struct {
	RestaurantID uuid.UUID `json:"-"`
}

type ManageUsersResponse struct {
	ID     uuid.UUID `json:"id"`
	Status string    `json:"status"`
}

type ManageUsers struct {
	tx     TxRunner
	repo   domain.UserRepository
	outbox domain.OutboxWriter
}

func NewManageUsers(tx TxRunner, repo domain.UserRepository, outbox domain.OutboxWriter) *ManageUsers {
	return &ManageUsers{tx: tx, repo: repo, outbox: outbox}
}
func (s *ManageUsers) Handle(ctx context.Context, in ManageUsersRequest) (ManageUsersResponse, error) {
	_ = in
	var out ManageUsersResponse
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		// US-004 is out of scope for Batch A.
		_ = s.repo
		_ = s.outbox
		return apperr.ErrNotImplemented
	})
	return out, err
}
