package application

import (
	"context"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/shared/apperr"
)

type CloseSession struct {
	tx     TxRunner
	repo   domain.DiningRepository
	outbox domain.OutboxWriter
}

func NewCloseSession(tx TxRunner, repo domain.DiningRepository, outbox domain.OutboxWriter) *CloseSession {
	return &CloseSession{tx: tx, repo: repo, outbox: outbox}
}
func (s *CloseSession) Handle(ctx context.Context, in Input) (Output, error) {
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
