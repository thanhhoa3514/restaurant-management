package application

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
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
	DeviceID  string `json:"device_id"`
	// ResumeAccessToken proves that a returning client already owns this device's
	// credential. DeviceID identifies a row; it is not a secret by itself.
	ResumeAccessToken string `json:"-"`
	IPHash            string `json:"-"`
	UserAgent         string `json:"-"`
	TraceID           string `json:"-"`
}

type JoinSessionResponse struct {
	Status      string     `json:"status"`
	AccessToken string     `json:"access_token,omitempty"`
	SessionID   *uuid.UUID `json:"session_id,omitempty"`
	TableID     *uuid.UUID `json:"table_id,omitempty"`
	TableCode   string     `json:"table_code,omitempty"`
	TableName   string     `json:"table_name,omitempty"`
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
	deviceID := strings.TrimSpace(req.DeviceID)
	if deviceID == "" {
		return out, apperr.New(apperr.CodeInvalid, "device_id is required")
	}
	guestName := strings.TrimSpace(req.GuestName)
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
			// No open session — this device opens the table as its owner. The
			// owner's typed name becomes the session's single customer name and
			// is never overwritten by later joiners (one name per table).
			sessionCode, codeErr := randomCode("S", 12)
			if codeErr != nil {
				return codeErr
			}
			session = &domain.DiningSession{
				RestaurantID: qr.RestaurantID,
				TableID:      qr.TableID,
				QRCodeID:     &qr.ID,
				SessionCode:  sessionCode,
				Status:       domain.SessionPendingVerification,
				OpenedVia:    domain.OpenedViaQRScan,
				CustomerName: guestName,
			}
			if err := s.repo.CreateSession(ctx, session); err != nil {
				return err
			}
			dev, derr := s.registerDevice(ctx, session, deviceID, guestName, true)
			if derr != nil {
				return derr
			}
			out = s.deviceResponse(ctx, qr, session, dev)
			return s.writeQRScanEvent(ctx, qr, session, "pending_verification", req)
		}

		// A session is already open on this table. Look the device up: a known
		// device (this phone refreshing, or already approved) is answered from
		// its own record; an unknown device is registered PENDING and must wait
		// for the waiter — a shared link never gets an instant seat.
		dev, derr := s.repo.FindSessionDevice(ctx, session.ID, deviceID)
		switch {
		case derr == nil:
			if dev.Status == domain.DeviceRejected {
				return apperr.New(apperr.CodeForbidden, "join request was declined by staff")
			}
			if !sameToken(req.ResumeAccessToken, dev.AccessToken) {
				return apperr.New(apperr.CodeUnauthorized, "device resume token is required")
			}
			out = s.deviceResponse(ctx, qr, session, dev)
			return nil
		case apperr.Is(derr, apperr.CodeNotFound):
			dev, err = s.registerDevice(ctx, session, deviceID, guestName, false)
			if err != nil {
				return err
			}
			out = s.deviceResponse(ctx, qr, session, dev)
			return s.writeQRScanEvent(ctx, qr, session, "pending_device", req)
		default:
			return derr
		}
	})
	return out, err
}

func sameToken(provided, expected string) bool {
	providedHash := sha256.Sum256([]byte(strings.TrimSpace(provided)))
	expectedHash := sha256.Sum256([]byte(expected))
	return strings.TrimSpace(provided) != "" && subtle.ConstantTimeCompare(providedHash[:], expectedHash[:]) == 1
}

// registerDevice mints a per-device bearer token and inserts a PENDING device
// row. The token is only a usable credential once a waiter approves the row.
func (s *JoinSession) registerDevice(ctx context.Context, session *domain.DiningSession, deviceID, guestName string, isOwner bool) (*domain.SessionDevice, error) {
	token, err := randomToken(32)
	if err != nil {
		return nil, err
	}
	dev := &domain.SessionDevice{
		RestaurantID: session.RestaurantID,
		SessionID:    session.ID,
		DeviceID:     deviceID,
		GuestName:    guestName,
		Status:       domain.DevicePending,
		AccessToken:  token,
		IsOwner:      isOwner,
	}
	if err := s.repo.CreateSessionDevice(ctx, dev); err != nil {
		return nil, err
	}
	return dev, nil
}

// deviceResponse frames a device row for the guest client. An APPROVED device
// on a live session reports the session status (the client proceeds to the
// menu); a PENDING device reports PENDING_VERIFICATION (the client waits and
// polls DeviceStatus with the returned token).
func (s *JoinSession) deviceResponse(ctx context.Context, qr *domain.QRCode, session *domain.DiningSession, dev *domain.SessionDevice) JoinSessionResponse {
	status := string(domain.SessionPendingVerification)
	if dev.Status == domain.DeviceApproved {
		status = string(session.Status)
	}
	out := JoinSessionResponse{
		Status:      status,
		AccessToken: dev.AccessToken,
		SessionID:   &session.ID,
		TableID:     &session.TableID,
	}
	if table, err := s.repo.FindTable(ctx, qr.RestaurantID, qr.TableID); err == nil && table != nil {
		out.TableCode = table.Code
		out.TableName = table.Name
	}
	return out
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
