package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type CancelPaymentRequest struct {
	InvoiceID uuid.UUID `json:"invoice_id"`
	PaymentID uuid.UUID `json:"payment_id"`
	ActorID   uuid.UUID `json:"-"`
}

type CancelPayment struct {
	tx                  TxRunner
	repo                domain.PaymentCancellationRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewCancelPayment(tx TxRunner, repo domain.PaymentCancellationRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *CancelPayment {
	return &CancelPayment{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *CancelPayment) Handle(ctx context.Context, in CancelPaymentRequest) (InvoiceResponse, error) {
	var out InvoiceResponse
	if in.InvoiceID == uuidNil {
		return out, apperr.New(apperr.CodeInvalid, "invoice_id is required")
	}
	if in.PaymentID == uuidNil {
		return out, apperr.New(apperr.CodeInvalid, "payment_id is required")
	}
	if in.ActorID == uuidNil {
		return out, apperr.New(apperr.CodeUnauthorized, "invalid user claim")
	}

	err := s.tx.Run(ctx, func(ctx context.Context) error {
		invoice, err := s.repo.CancelProcessingPayment(
			ctx,
			s.defaultRestaurantID,
			in.InvoiceID,
			in.PaymentID,
		)
		if err != nil {
			return err
		}
		if s.outbox != nil {
			if err := s.outbox.Write(ctx, outbox.WriteEvent{
				RestaurantID:  s.defaultRestaurantID,
				AggregateType: "payment",
				AggregateID:   in.PaymentID,
				EventType:     "billing.payment_failed",
				Payload: map[string]any{
					"invoice_id":        invoice.ID,
					"dining_session_id": invoice.DiningSessionID,
					"payment_id":        in.PaymentID,
					"reason":            "cancelled_by_cashier",
				},
				Metadata: map[string]any{
					"actor_type": "STAFF",
					"actor_id":   in.ActorID,
					"action":     "payment.cancelled",
				},
				Priority: 4,
			}); err != nil {
				return err
			}
		}
		out = toResponse(invoice)
		return nil
	})
	return out, err
}
