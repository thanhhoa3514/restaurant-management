package application

import (
	"context"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/shared/apperr"
)

type ManageTableQR struct {
	tx     TxRunner
	repo   domain.DiningRepository
	outbox domain.OutboxWriter
}

func NewManageTableQR(tx TxRunner, repo domain.DiningRepository, outbox domain.OutboxWriter) *ManageTableQR {
	return &ManageTableQR{tx: tx, repo: repo, outbox: outbox}
}
func (s *ManageTableQR) Handle(ctx context.Context, in Input) (Output, error) {
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
