package application

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type JoinSessionRequest struct {
	QRToken   string `json:"qr_token"`
	GuestName string `json:"guest_name"`
	IPHash    string `json:"-"`
	UserAgent string `json:"-"`
	TraceID   string `json:"-"`
}

type JoinSessionResponse struct {
	Status       string     `json:"status"`
	SessionToken string     `json:"session_token,omitempty"`
	SessionID    *uuid.UUID `json:"session_id,omitempty"`
	TableID      *uuid.UUID `json:"table_id,omitempty"`
	TableCode    string     `json:"table_code,omitempty"`
	TableName    string     `json:"table_name,omitempty"`
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
	qrToken := strings.TrimSpace(req.QRToken)
	if qrToken == "" {
		return out, apperr.New(apperr.CodeInvalid, "qr_token is required")
	}
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		qr, err := s.repo.FindQRByToken(ctx, qrToken)
		if err != nil {
			if apperr.Is(err, apperr.CodeNotFound) {
				return apperr.New(apperr.CodeUnauthorized, "invalid qr token")
			}
			return err
		}
		if !qr.IsActive {
			if err := s.writeQRScanEvent(ctx, qr, nil, "invalid_or_revoked", req); err != nil {
				return err
			}
			return apperr.New(apperr.CodeUnauthorized, "invalid qr token")
		}

		session, err := s.repo.FindActiveSessionByTable(ctx, qr.RestaurantID, qr.TableID)
		if err != nil {
			if !apperr.Is(err, apperr.CodeNotFound) {
				return err
			}
			// No active session — create a new one in PENDING_VERIFICATION.
			sessionCode, codeErr := randomCode("S", 12)
			if codeErr != nil {
				return codeErr
			}
			sessionToken, tokenErr := randomToken(32)
			if tokenErr != nil {
				return tokenErr
			}
			session = &domain.DiningSession{
				RestaurantID: qr.RestaurantID,
				TableID:      qr.TableID,
				QRCodeID:     &qr.ID,
				SessionCode:  sessionCode,
				SessionToken: sessionToken,
				Status:       domain.SessionPendingVerification,
				OpenedVia:    domain.OpenedViaQRScan,
			}
			if name := strings.TrimSpace(req.GuestName); name != "" {
				session.CustomerName = name
			}
			if err := s.repo.CreateSession(ctx, session); err != nil {
				return err
			}
			out = JoinSessionResponse{
				Status:       string(session.Status),
				SessionToken: session.SessionToken,
				SessionID:    &session.ID,
				TableID:      &session.TableID,
			}
			if table, tableErr := s.repo.FindTable(ctx, qr.RestaurantID, qr.TableID); tableErr == nil && table != nil {
				out.TableCode = table.Code
				out.TableName = table.Name
			}
			return s.writeQRScanEvent(ctx, qr, session, "pending_verification", req)
		}
		out = JoinSessionResponse{
			Status:       string(session.Status),
			SessionToken: session.SessionToken,
			SessionID:    &session.ID,
			TableID:      &session.TableID,
		}
		if table, err := s.repo.FindTable(ctx, qr.RestaurantID, qr.TableID); err == nil && table != nil {
			out.TableCode = table.Code
			out.TableName = table.Name
		}
		if name := strings.TrimSpace(req.GuestName); name != "" {
			if err := s.repo.UpdateSessionCustomerName(ctx, session.ID, name); err != nil {
				return err
			}
			session.CustomerName = name
		}
		return s.writeQRScanEvent(ctx, qr, session, scanOutcome(session.Status), req)
	})
	return out, err
}

func scanOutcome(status domain.SessionStatus) string {
	switch status {
	case domain.SessionActive:
		return "joined_active"
	case domain.SessionAwaitingPayment:
		return "awaiting_payment"
	default:
		return strings.ToLower(string(status))
	}
}

func (s *JoinSession) writeQRScanEvent(ctx context.Context, qr *domain.QRCode, session *domain.DiningSession, outcome string, req JoinSessionRequest) error {
	if s.outbox == nil || qr == nil {
		return nil
	}

	payload := map[string]any{
		"qr_code_id": qr.ID,
		"table_id":   qr.TableID,
		"outcome":    outcome,
		"guest_name": req.GuestName,
	}
	dedupeKey := "qr_scan:" + qr.ID.String() + ":" + outcome + ":" + req.IPHash
	window := 5 * time.Minute
	if session != nil {
		payload["session_id"] = session.ID
		payload["session_status"] = string(session.Status)
		dedupeKey = "qr_scan:" + qr.ID.String() + ":" + session.ID.String()
		window = 30 * time.Minute
	}

	return s.outbox.Write(ctx, outbox.WriteEvent{
		RestaurantID:  qr.RestaurantID,
		AggregateType: "qr_code",
		AggregateID:   qr.ID,
		EventType:     "dining.qr_scanned",
		Payload:       payload,
		Metadata: map[string]any{
			"actor_type": "GUEST",
			"action":     "qr.scanned",
			"ip_hash":    req.IPHash,
			"user_agent": req.UserAgent,
			"trace_id":   req.TraceID,
		},
		Priority:     4,
		DedupeKey:    dedupeKey,
		DedupeWindow: window,
	})
}
