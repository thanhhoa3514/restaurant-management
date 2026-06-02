package application

import (
	"context"

	"restaurant-management/internal/modules/catalog/domain"
	"restaurant-management/internal/shared/apperr"
)

type DeleteMenuItem struct {
	tx     TxRunner
	repo   domain.MenuRepository
	outbox domain.OutboxWriter
}

func NewDeleteMenuItem(tx TxRunner, repo domain.MenuRepository, outbox domain.OutboxWriter) *DeleteMenuItem {
	return &DeleteMenuItem{tx: tx, repo: repo, outbox: outbox}
}
func (s *DeleteMenuItem) Handle(ctx context.Context, in Input) (Output, error) {
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
