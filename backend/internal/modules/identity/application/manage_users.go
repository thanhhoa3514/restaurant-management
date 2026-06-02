package application

import (
	"context"

	"restaurant-management/internal/modules/identity/domain"
	"restaurant-management/internal/shared/apperr"
)

type ManageUsers struct {
	tx     TxRunner
	repo   domain.UserRepository
	outbox domain.OutboxWriter
}

func NewManageUsers(tx TxRunner, repo domain.UserRepository, outbox domain.OutboxWriter) *ManageUsers {
	return &ManageUsers{tx: tx, repo: repo, outbox: outbox}
}
func (s *ManageUsers) Handle(ctx context.Context, in Input) (Output, error) {
	_ = in
	var out Output
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		// TODO: orchestrate domain changes, repository calls, and outbox write in this transaction.
		_ = s.repo
		_ = s.outbox
		return apperr.ErrNotImplemented
	})
	return out, err
}
