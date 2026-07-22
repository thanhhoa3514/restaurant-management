package application

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
)

type OpenSessionRequest struct {
	TableID  uuid.UUID `json:"table_id"`
	OpenedBy uuid.UUID `json:"-"`
}

type OpenSessionResponse struct {
	SessionID    uuid.UUID `json:"session_id"`
	SessionCode  string    `json:"session_code"`
	TableID      uuid.UUID `json:"table_id"`
	Status       string    `json:"status"`
	SessionToken string    `json:"session_token"`
}

type OpenSession struct {
	tx                  TxRunner
	repo                domain.DiningRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewOpenSession(tx TxRunner, repo domain.DiningRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *OpenSession {
	return &OpenSession{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *OpenSession) Handle(ctx context.Context, req OpenSessionRequest) (OpenSessionResponse, error) {
	var out OpenSessionResponse
	restaurantID := s.defaultRestaurantID
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		if _, err := s.repo.FindTable(ctx, restaurantID, req.TableID); err != nil {
			return err
		}
		qr, err := s.repo.ActiveQRForTable(ctx, restaurantID, req.TableID)
		if err != nil {
			return err
		}
		var qrID *uuid.UUID
		if qr != nil {
			qrID = &qr.ID
		}
		sessionCode, err := randomCode("S", 12)
		if err != nil {
			return err
		}
		sessionToken, err := randomToken(32)
		if err != nil {
			return err
		}
		session := &domain.DiningSession{
			RestaurantID: restaurantID,
			TableID:      req.TableID,
			QRCodeID:     qrID,
			SessionCode:  sessionCode,
			SessionToken: sessionToken,
			Status:       domain.SessionActive,
			OpenedVia:    domain.OpenedViaStaff,
			OpenedBy:     &req.OpenedBy,
		}
		if err := s.repo.CreateSession(ctx, session); err != nil {
			return err
		}
		out = OpenSessionResponse{SessionID: session.ID, SessionCode: session.SessionCode, TableID: session.TableID, Status: string(session.Status), SessionToken: session.SessionToken}
		_ = s.outbox
		return nil
	})
	return out, err
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func randomCode(prefix string, n int) (string, error) {
	token, err := randomToken(n)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s-%s", prefix, token), nil
}
