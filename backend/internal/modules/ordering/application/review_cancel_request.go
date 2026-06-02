package application

import (
	"context"

	"restaurant-management/internal/modules/ordering/domain"
	"restaurant-management/internal/shared/apperr"
)

type ReviewCancelRequest struct {
	tx     TxRunner
	repo   domain.OrderRepository
	outbox domain.OutboxWriter
}

func NewReviewCancelRequest(tx TxRunner, repo domain.OrderRepository, outbox domain.OutboxWriter) *ReviewCancelRequest {
	return &ReviewCancelRequest{tx: tx, repo: repo, outbox: outbox}
}
func (s *ReviewCancelRequest) Handle(ctx context.Context, in Input) (Output, error) {
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
