package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/shared/apperr"
)

type CloseSessionRequest struct {
	SessionID uuid.UUID `json:"session_id"`
}

type CloseSessionResponse struct {
	ID     uuid.UUID `json:"id"`
	Status string    `json:"status"`
}

type CloseSession struct {
	tx     TxRunner
	repo   domain.DiningRepository
	outbox domain.OutboxWriter
}

func NewCloseSession(tx TxRunner, repo domain.DiningRepository, outbox domain.OutboxWriter) *CloseSession {
	return &CloseSession{tx: tx, repo: repo, outbox: outbox}
}
func (s *CloseSession) Handle(ctx context.Context, in CloseSessionRequest) (CloseSessionResponse, error) {
	_ = in
	var out CloseSessionResponse
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		_ = s.repo
		_ = s.outbox
		return apperr.ErrNotImplemented
	})
	return out, err
}
