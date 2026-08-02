package application

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

// ApproveDevice is the waiter's confirmation gate. Approving the table's first
// (owner) device also flips the session PENDING_VERIFICATION -> ACTIVE; the
// session never returns to PENDING when a later device is approved, so the
// first guest is never blocked by someone else joining.
type ApproveDeviceRequest struct {
	DeviceID uuid.UUID `json:"-"`
	ActorID  uuid.UUID `json:"-"`
	Action   string    `json:"action"`
}

type ApproveDeviceResponse struct {
	DeviceID uuid.UUID `json:"device_id"`
	Status   string    `json:"status"`
}

type ApproveDevice struct {
	tx                  TxRunner
	repo                domain.DiningRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewApproveDevice(tx TxRunner, repo domain.DiningRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *ApproveDevice {
	return &ApproveDevice{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *ApproveDevice) Handle(ctx context.Context, req ApproveDeviceRequest) (ApproveDeviceResponse, error) {
	var out ApproveDeviceResponse
	restaurantID := s.defaultRestaurantID
	action := strings.ToLower(strings.TrimSpace(req.Action))
	if action != "approve" && action != "reject" {
		return out, apperr.New(apperr.CodeInvalid, "action must be approve or reject")
	}

	err := s.tx.Run(ctx, func(ctx context.Context) error {
		currentDevice, err := s.repo.FindSessionDeviceByID(ctx, restaurantID, req.DeviceID)
		if err != nil {
			return err
		}
		session, err := s.repo.FindSessionByID(ctx, restaurantID, currentDevice.SessionID)
		if err != nil {
			return err
		}

		if action == "reject" {
			dev, err := s.repo.SetDeviceStatus(ctx, restaurantID, req.DeviceID, domain.DeviceRejected, &req.ActorID)
			if err != nil {
				return err
			}
			out = ApproveDeviceResponse{DeviceID: dev.ID, Status: string(dev.Status)}

			// Rejecting the owner of a table that never activated must abandon the
			// whole session. Otherwise the PENDING_VERIFICATION row keeps the
			// one-open-per-table unique index occupied and every retry / new guest
			// 500s on CreateSession, hard-bricking the table until a DB fix.
			if dev.IsOwner && session.Status == domain.SessionPendingVerification {
				if err := s.repo.AbandonPendingSession(ctx, restaurantID, session.ID, &req.ActorID); err != nil {
					return err
				}
			}
			return s.writeEvent(ctx, restaurantID, dev, "dining.device_rejected", "")
		}

		if session.Status == domain.SessionPendingVerification && !currentDevice.IsOwner {
			return apperr.New(apperr.CodeConflict, "owner device must be approved first")
		}
		if session.Status == domain.SessionClosed {
			return apperr.New(apperr.CodeConflict, "dining session is closed")
		}

		dev, err := s.repo.SetDeviceStatus(ctx, restaurantID, req.DeviceID, domain.DeviceApproved, &req.ActorID)
		if err != nil {
			return err
		}

		// Approving the owner device is what activates the table. Later devices
		// join an already-ACTIVE session, so this branch is skipped and the
		// session status is left untouched.
		if session.Status == domain.SessionPendingVerification {
			if err := s.repo.VerifySession(ctx, restaurantID, session.ID, &req.ActorID); err != nil {
				return err
			}
			out = ApproveDeviceResponse{DeviceID: dev.ID, Status: string(dev.Status)}
			return s.writeEvent(ctx, restaurantID, dev, "dining.session_verified", "ACTIVE")
		}

		out = ApproveDeviceResponse{DeviceID: dev.ID, Status: string(dev.Status)}
		return s.writeEvent(ctx, restaurantID, dev, "dining.device_approved", string(session.Status))
	})
	return out, err
}

func (s *ApproveDevice) writeEvent(ctx context.Context, restaurantID uuid.UUID, dev *domain.SessionDevice, eventType, sessionStatus string) error {
	if s.outbox == nil {
		return nil
	}
	payload := map[string]any{
		"session_id": dev.SessionID,
		"device_id":  dev.ID,
	}
	if sessionStatus != "" {
		payload["status"] = sessionStatus
	}
	// Look up the table so the realtime topic reaches the table's guests.
	if session, err := s.repo.FindSessionByID(ctx, restaurantID, dev.SessionID); err == nil && session != nil {
		payload["table_id"] = session.TableID
	}
	return s.outbox.Write(ctx, outbox.WriteEvent{
		RestaurantID:  restaurantID,
		AggregateType: "dining_session",
		AggregateID:   dev.SessionID,
		EventType:     eventType,
		Payload:       payload,
	})
}
