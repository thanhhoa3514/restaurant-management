package application

import (
	"context"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/shared/apperr"
)

type ProcessPayment struct {
	tx     TxRunner
	repo   domain.InvoiceRepository
	outbox domain.OutboxWriter
}

func NewProcessPayment(tx TxRunner, repo domain.InvoiceRepository, outbox domain.OutboxWriter) *ProcessPayment {
	return &ProcessPayment{tx: tx, repo: repo, outbox: outbox}
}
func (s *ProcessPayment) Handle(ctx context.Context, in Input) (Output, error) {
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
