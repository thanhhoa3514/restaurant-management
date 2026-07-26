package application

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type ProcessPartialPaymentRequest struct {
	InvoiceID         uuid.UUID `json:"invoice_id"`
	PaymentMethodCode string    `json:"payment_method_code"`
	ReceivedAmountVND int64     `json:"received_amount_vnd"`
	ReferenceCode     string    `json:"reference_code"`
	ActorID           uuid.UUID `json:"-"`
}

type ProcessPartialPayment struct {
	tx                 TxRunner
	repo               domain.InvoiceRepository
	outbox             domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewProcessPartialPayment(tx TxRunner, repo domain.InvoiceRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *ProcessPartialPayment {
	return &ProcessPartialPayment{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *ProcessPartialPayment) Handle(ctx context.Context, in ProcessPartialPaymentRequest) (InvoiceResponse, error) {
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

	err := s.tx.Run(ctx, func(ctx context.Context) error {
		method, err := s.repo.FindPaymentMethod(ctx, s.defaultRestaurantID, methodCode)
		if err != nil {
			return err
		}
		if method.Type == "E_WALLET" {
			return apperr.New(apperr.CodeInvalid, "partial payment with e-wallet is not supported, use full payment")
		}

		invoice, err := s.repo.ProcessPartialPayment(ctx, s.defaultRestaurantID, domain.PartialPaymentInput{
			InvoiceID:         in.InvoiceID,
			PaymentMethodCode: method.Code,
			ReceivedAmountVND: in.ReceivedAmountVND,
			ReferenceCode:     strings.TrimSpace(in.ReferenceCode),
			ProcessedBy:       in.ActorID,
		})
		if err != nil {
			return err
		}

		eventType := "billing.payment_completed"
		if invoice.Status == domain.InvoicePartiallyPaid {
			eventType = "billing.payment_partial"
		}

		if s.outbox != nil {
			// Khách đưa dư thì phần ghi nhận vào hóa đơn nhỏ hơn tiền đưa.
			paidAmount := in.ReceivedAmountVND
			if invoice.Payment != nil {
				paidAmount = invoice.Payment.AmountVND
			}
			if err := s.outbox.Write(ctx, outbox.WriteEvent{
				RestaurantID:  s.defaultRestaurantID,
				AggregateType: "invoice",
				AggregateID:   invoice.ID,
				EventType:     eventType,
				Payload: map[string]any{
					"invoice_id":          invoice.ID,
					"dining_session_id":   invoice.DiningSessionID,
					"payment_method_code": method.Code,
					"amount_vnd":          paidAmount,
					"running_paid_vnd":    invoice.PaidAmountVND,
					"total_vnd":           invoice.TotalAmountVND,
				},
				Metadata: map[string]any{"actor_type": "STAFF", "action": "payment.partial"},
				Priority: 3,
			}); err != nil {
				return err
			}

			if invoice.Status == domain.InvoicePaid && invoice.DiningSessionID != uuidNil {
				if err := s.outbox.Write(ctx, outbox.WriteEvent{
					RestaurantID:  s.defaultRestaurantID,
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
		}

		out = toResponse(invoice)
		return nil
	})
	return out, err
}
