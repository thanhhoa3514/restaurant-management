package application

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/shared/apperr"
)

type JoinSessionRequest struct {
	QRToken string `json:"qr_token"`
}

type JoinSessionResponse struct {
	Status       string     `json:"status"`
	SessionToken string     `json:"session_token,omitempty"`
	SessionID    *uuid.UUID `json:"session_id,omitempty"`
	TableID      *uuid.UUID `json:"table_id,omitempty"`
	RestaurantID *uuid.UUID `json:"restaurant_id,omitempty"`
}

type JoinSession struct {
	tx     TxRunner
	repo   domain.DiningRepository
	outbox domain.OutboxWriter
}

func NewJoinSession(tx TxRunner, repo domain.DiningRepository, outbox domain.OutboxWriter) *JoinSession {
	return &JoinSession{tx: tx, repo: repo, outbox: outbox}
}
func (s *JoinSession) Handle(ctx context.Context, req JoinSessionRequest) (JoinSessionResponse, error) {
	var out JoinSessionResponse
	if strings.TrimSpace(req.QRToken) == "" {
		return out, apperr.New(apperr.CodeInvalid, "qr_token is required")
	}
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		restaurantID, tableID, err := s.repo.ResolveQRToken(ctx, strings.TrimSpace(req.QRToken))
		if err != nil {
			if apperr.Is(err, apperr.CodeNotFound) {
				return apperr.New(apperr.CodeUnauthorized, "invalid qr token")
			}
			return err
		}
		session, err := s.repo.FindActiveSessionByTable(ctx, restaurantID, tableID)
		if err != nil {
			if apperr.Is(err, apperr.CodeNotFound) {
				out = JoinSessionResponse{Status: "not_opened"}
				return nil
			}
			return err
		}
		out = JoinSessionResponse{
			Status:       string(session.Status),
			SessionToken: session.SessionToken,
			SessionID:    &session.ID,
			TableID:      &session.TableID,
			RestaurantID: &session.RestaurantID,
		}
		_ = s.outbox
		return nil
	})
	return out, err
}
