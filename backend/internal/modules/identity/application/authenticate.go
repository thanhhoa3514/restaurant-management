package application

import (
	"context"

	"restaurant-management/internal/modules/identity/domain"
	"restaurant-management/internal/shared/apperr"
)

type Authenticate struct {
	tx     TxRunner
	repo   domain.UserRepository
	outbox domain.OutboxWriter
}

func NewAuthenticate(tx TxRunner, repo domain.UserRepository, outbox domain.OutboxWriter) *Authenticate {
	return &Authenticate{tx: tx, repo: repo, outbox: outbox}
}
func (s *Authenticate) Handle(ctx context.Context, in Input) (Output, error) {
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
