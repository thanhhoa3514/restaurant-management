package application

import (
	"context"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/shared/apperr"
)

type AdjustInvoice struct {
	tx     TxRunner
	repo   domain.InvoiceRepository
	outbox domain.OutboxWriter
}

func NewAdjustInvoice(tx TxRunner, repo domain.InvoiceRepository, outbox domain.OutboxWriter) *AdjustInvoice {
	return &AdjustInvoice{tx: tx, repo: repo, outbox: outbox}
}
func (s *AdjustInvoice) Handle(ctx context.Context, in Input) (Output, error) {
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
