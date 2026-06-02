package application

import (
	"context"

	"restaurant-management/internal/modules/catalog/domain"
	"restaurant-management/internal/shared/apperr"
)

type UpdateMenuItem struct {
	tx     TxRunner
	repo   domain.MenuRepository
	outbox domain.OutboxWriter
}

func NewUpdateMenuItem(tx TxRunner, repo domain.MenuRepository, outbox domain.OutboxWriter) *UpdateMenuItem {
	return &UpdateMenuItem{tx: tx, repo: repo, outbox: outbox}
}
func (s *UpdateMenuItem) Handle(ctx context.Context, in Input) (Output, error) {
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
