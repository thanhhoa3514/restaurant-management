package application

import (
	"context"
	"strings"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/platform/tenant"
	"restaurant-management/internal/shared/apperr"
)

type ProcessPayment struct {
	tx     TxRunner
	repo   domain.InvoiceRepository
	outbox domain.OutboxWriter
}

func NewProcessPayment(tx TxRunner, repo domain.InvoiceRepository, outbox domain.OutboxWriter) *ProcessPayment {
	return &ProcessPayment{tx: tx, repo: repo, outbox: outbox}
}

func (s *ProcessPayment) Handle(ctx context.Context, in ProcessPaymentRequest) (InvoiceResponse, error) {
	var out InvoiceResponse
	if in.InvoiceID == uuidNil {
		return out, apperr.New(apperr.CodeInvalid, "invoice_id is required")
	}
	methodCode := strings.ToLower(strings.TrimSpace(in.PaymentMethodCode))
	if methodCode == "" {
		return out, apperr.New(apperr.CodeInvalid, "payment_method_code is required")
	}
	if in.ReceivedAmountVND <= 0 {
		return out, apperr.New(apperr.CodeInvalid, "received_amount_vnd must be positive")
	}
	if in.ActorID == uuidNil {
		return out, apperr.New(apperr.CodeUnauthorized, "invalid user claim")
	}
	restaurantID, err := tenant.MustRestaurantID(ctx)
	if err != nil {
		return out, err
	}
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		invoice, err := s.repo.ProcessPayment(ctx, restaurantID, domain.PaymentInput{
			InvoiceID:         in.InvoiceID,
			PaymentMethodCode: methodCode,
			ReceivedAmountVND: in.ReceivedAmountVND,
			ReferenceCode:     strings.TrimSpace(in.ReferenceCode),
			ProcessedBy:       in.ActorID,
		})
		if err != nil {
			return err
		}
		if s.outbox != nil {
			if err := s.outbox.Write(ctx, outbox.WriteEvent{
				RestaurantID:  restaurantID,
				AggregateType: "invoice",
				AggregateID:   invoice.ID,
				EventType:     "billing.payment_completed",
				Payload: map[string]any{
					"invoice_id":          invoice.ID,
					"dining_session_id":   invoice.DiningSessionID,
					"payment_id":          invoice.Payment.ID,
					"payment_method_code": invoice.Payment.MethodCode,
					"amount_vnd":          invoice.Payment.AmountVND,
					"received_amount_vnd": invoice.Payment.ReceivedAmountVND,
					"change_amount_vnd":   invoice.Payment.ChangeAmountVND,
				},
				Metadata: map[string]any{"actor_type": "STAFF", "action": "payment.completed"},
				Priority: 3,
			}); err != nil {
				return err
			}
			if err := s.outbox.Write(ctx, outbox.WriteEvent{
				RestaurantID:  restaurantID,
				AggregateType: "dining_session",
				AggregateID:   invoice.DiningSessionID,
				EventType:     "dining.session_closed",
				Payload: map[string]any{
					"dining_session_id": invoice.DiningSessionID,
					"invoice_id":        invoice.ID,
					"closed_by":         in.ActorID,
					"reason":            "payment_completed",
				},
				Metadata: map[string]any{"actor_type": "STAFF", "action": "session.closed"},
				Priority: 3,
			}); err != nil {
				return err
			}
		}
		out = toResponse(invoice)
		return nil
	})
	return out, err
}
