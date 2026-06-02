package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/shared/apperr"
)

type ManageTableQRRequest struct {
	TableID uuid.UUID `json:"table_id"`
}

type ManageTableQRResponse struct {
	ID     uuid.UUID `json:"id"`
	Status string    `json:"status"`
}

type ManageTableQR struct {
	tx     TxRunner
	repo   domain.DiningRepository
	outbox domain.OutboxWriter
}

func NewManageTableQR(tx TxRunner, repo domain.DiningRepository, outbox domain.OutboxWriter) *ManageTableQR {
	return &ManageTableQR{tx: tx, repo: repo, outbox: outbox}
}
func (s *ManageTableQR) Handle(ctx context.Context, in ManageTableQRRequest) (ManageTableQRResponse, error) {
	_ = in
	var out ManageTableQRResponse
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		_ = s.repo
		_ = s.outbox
		return apperr.ErrNotImplemented
	})
	return out, err
}
