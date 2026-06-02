package application

import (
	"context"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/shared/apperr"
)

type BuildInvoice struct {
	tx     TxRunner
	repo   domain.InvoiceRepository
	outbox domain.OutboxWriter
}

func NewBuildInvoice(tx TxRunner, repo domain.InvoiceRepository, outbox domain.OutboxWriter) *BuildInvoice {
	return &BuildInvoice{tx: tx, repo: repo, outbox: outbox}
}
func (s *BuildInvoice) Handle(ctx context.Context, in Input) (Output, error) {
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
