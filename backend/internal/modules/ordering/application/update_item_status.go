package application

import (
	"context"

	"restaurant-management/internal/modules/ordering/domain"
	"restaurant-management/internal/shared/apperr"
)

type UpdateItemStatus struct {
	tx     TxRunner
	repo   domain.OrderRepository
	outbox domain.OutboxWriter
}

func NewUpdateItemStatus(tx TxRunner, repo domain.OrderRepository, outbox domain.OutboxWriter) *UpdateItemStatus {
	return &UpdateItemStatus{tx: tx, repo: repo, outbox: outbox}
}
func (s *UpdateItemStatus) Handle(ctx context.Context, in Input) (Output, error) {
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
