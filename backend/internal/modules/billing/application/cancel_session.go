package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type CancelSessionRequest struct {
	SessionID uuid.UUID `json:"session_id"`
	ActorID   uuid.UUID `json:"-"`
}

type CancelSessionResponse struct {
	ID               uuid.UUID   `json:"id"`
	Status           string      `json:"status"`
	VoidedInvoiceIDs []uuid.UUID `json:"voided_invoice_ids"`
}

type CancelSession struct {
	tx                  TxRunner
	repo                domain.SessionCancellationRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewCancelSession(tx TxRunner, repo domain.SessionCancellationRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *CancelSession {
	return &CancelSession{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *CancelSession) Handle(ctx context.Context, in CancelSessionRequest) (CancelSessionResponse, error) {
	var out CancelSessionResponse
	if in.SessionID == uuid.Nil {
		return out, apperr.New(apperr.CodeInvalid, "session_id is required")
	}
	if in.ActorID == uuid.Nil {
		return out, apperr.New(apperr.CodeUnauthorized, "invalid user claim")
	}

	err := s.tx.Run(ctx, func(ctx context.Context) error {
		result, err := s.repo.CancelSession(ctx, s.defaultRestaurantID, in.SessionID, in.ActorID)
		if err != nil {
			return err
		}

		if result.ClosedNow && s.outbox != nil {
			for _, invoiceID := range result.VoidedInvoiceIDs {
				if err := s.outbox.Write(ctx, outbox.WriteEvent{
					RestaurantID:  s.defaultRestaurantID,
					AggregateType: "invoice",
					AggregateID:   invoiceID,
					EventType:     "billing.invoice_voided",
					Payload: map[string]any{
						"invoice_id":        invoiceID,
						"dining_session_id": result.SessionID,
						"void_reason":       "cancelled_by_cashier",
						"voided_by":         in.ActorID,
					},
					Metadata: map[string]any{"actor_type": "STAFF", "action": "invoice.voided"},
					Priority: 4,
				}); err != nil {
					return err
				}
			}

			for _, sessionID := range result.SessionIDs {
				if err := s.outbox.Write(ctx, outbox.WriteEvent{
					RestaurantID:  s.defaultRestaurantID,
					AggregateType: "dining_session",
					AggregateID:   sessionID,
					EventType:     "dining.session_closed",
					Payload: map[string]any{
						"dining_session_id": sessionID,
						"closed_by":         in.ActorID,
						"reason":            "cancelled_by_cashier",
					},
					Metadata: map[string]any{"actor_type": "STAFF", "action": "session.cancelled"},
					Priority: 3,
				}); err != nil {
					return err
				}
			}
		}

		voidedInvoiceIDs := result.VoidedInvoiceIDs
		if voidedInvoiceIDs == nil {
			voidedInvoiceIDs = []uuid.UUID{}
		}
		out = CancelSessionResponse{
			ID:               result.SessionID,
			Status:           "CLOSED",
			VoidedInvoiceIDs: voidedInvoiceIDs,
		}
		return nil
	})
	return out, err
}
