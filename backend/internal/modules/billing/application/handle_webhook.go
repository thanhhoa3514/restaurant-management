package application

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type WebhookResult struct {
	Invoice *InvoiceResponse
	Ack     domain.WebhookAck
	Ignored bool
}

type HandleWebhook struct {
	tx                  TxRunner
	repo                domain.InvoiceRepository
	outbox              domain.OutboxWriter
	gateways            *domain.GatewayRegistry
	mockSecret          string
	defaultRestaurantID uuid.UUID
}

func NewHandleWebhook(tx TxRunner, repo domain.InvoiceRepository, outbox domain.OutboxWriter, gateways *domain.GatewayRegistry, mockSecret string, defaultRestaurantID uuid.UUID) *HandleWebhook {
	return &HandleWebhook{tx: tx, repo: repo, outbox: outbox, gateways: gateways, mockSecret: mockSecret, defaultRestaurantID: defaultRestaurantID}
}

func (s *HandleWebhook) Handle(ctx context.Context, provider string, raw []byte, headers http.Header) (WebhookResult, error) {
	var result WebhookResult
	gateway, ok := s.gateways.Get(provider)
	if !ok {
		return result, apperr.New(apperr.CodeNotFound, "payment provider not found")
	}
	event, err := gateway.ParseWebhook(ctx, raw, headers)
	if err != nil {
		return result, err
	}
	result.Ack = ackFor(gateway, event)
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		payment, err := s.repo.FindWebhookPayment(ctx, event.GatewayTransactionID, event.OrderRef)
		if err != nil {
			return err
		}
		if payment == nil {
			result.Ignored = true
			return nil
		}
		eventRowID, inserted, err := s.repo.InsertWebhookEvent(ctx, payment.RestaurantID, event.Provider, event.EventID, payment.ID, event.Raw)
		if err != nil {
			return err
		}
		if !inserted {
			result.Ignored = true
			return nil
		}
		if event.AmountVND != payment.AmountVND {
			if err := s.repo.MarkWebhookError(ctx, eventRowID, fmt.Sprintf("amount mismatch: got %d want %d", event.AmountVND, payment.AmountVND)); err != nil {
				return err
			}
			result.Ignored = true
			return nil
		}

		var invoice *domain.Invoice
		switch event.Status {
		case domain.PaymentCompleted:
			invoice, err = s.repo.CompleteWebhookPayment(ctx, payment.RestaurantID, payment.ID, event)
		case domain.PaymentFailed:
			invoice, err = s.repo.FailWebhookPayment(ctx, payment.RestaurantID, payment.ID, event)
		default:
			if err := s.repo.MarkWebhookError(ctx, eventRowID, "unsupported webhook status"); err != nil {
				return err
			}
			result.Ignored = true
			return nil
		}
		if err != nil {
			_ = s.repo.MarkWebhookError(ctx, eventRowID, err.Error())
			return err
		}
		if event.Status == domain.PaymentCompleted {
			if err := s.writePaymentCompleted(ctx, payment.RestaurantID, invoice); err != nil {
				return err
			}
		} else if event.Status == domain.PaymentFailed {
			if err := s.writePaymentFailed(ctx, payment.RestaurantID, invoice); err != nil {
				return err
			}
		}
		if err := s.repo.MarkWebhookProcessed(ctx, eventRowID); err != nil {
			return err
		}
		invoiceResp := toResponse(invoice)
		result.Invoice = &invoiceResp
		return nil
	})
	return result, err
}

func (s *HandleWebhook) SimulateMock(ctx context.Context, paymentNumber, simResult string) (WebhookResult, error) {
	paymentNumber = strings.TrimSpace(paymentNumber)
	if paymentNumber == "" {
		return WebhookResult{}, apperr.New(apperr.CodeInvalid, "payment_number is required")
	}
	payment, err := s.repo.FindWebhookPayment(ctx, "", paymentNumber)
	if err != nil {
		return WebhookResult{}, err
	}
	if payment == nil {
		return WebhookResult{}, apperr.New(apperr.CodeNotFound, "payment not found")
	}
	status := "FAILED"
	if strings.EqualFold(simResult, "success") || strings.EqualFold(simResult, "completed") {
		status = "COMPLETED"
	}
	payload := map[string]any{
		"event_id":               "mock:" + payment.PaymentNumber + ":" + strings.ToLower(status),
		"gateway_transaction_id": "MOCK-" + payment.PaymentNumber,
		"payment_number":         payment.PaymentNumber,
		"amount_vnd":             payment.AmountVND,
		"status":                 status,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return WebhookResult{}, err
	}
	headers := http.Header{}
	headers.Set("X-Mock-Signature", hmacSHA256Hex(s.mockSecret, string(raw)))
	return s.Handle(ctx, "mock", raw, headers)
}

func ackFor(gateway domain.PaymentGateway, event domain.WebhookEvent) domain.WebhookAck {
	if acker, ok := gateway.(domain.WebhookAcker); ok {
		ack := acker.WebhookAck(event)
		if ack.Status != 0 {
			return ack
		}
	}
	return domain.WebhookAck{Status: http.StatusOK, Body: map[string]any{"ok": true}}
}

func hmacSHA256Hex(secret, data string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(data))
	return hex.EncodeToString(mac.Sum(nil))
}

func (s *HandleWebhook) writePaymentCompleted(ctx context.Context, restaurantID uuid.UUID, invoice *domain.Invoice) error {
	if s.outbox == nil || invoice == nil || invoice.Payment == nil {
		return nil
	}
	if err := s.outbox.Write(ctx, outbox.WriteEvent{
		RestaurantID:  restaurantID,
		AggregateType: "invoice",
		AggregateID:   invoice.ID,
		EventType:     "billing.payment_completed",
		Payload: map[string]any{
			"invoice_id":          invoice.ID,
			"dining_session_id":   invoice.DiningSessionID,
			"payment_id":          invoice.Payment.ID,
			"payment_number":      invoice.Payment.PaymentNumber,
			"payment_method_code": invoice.Payment.MethodCode,
			"amount_vnd":          invoice.Payment.AmountVND,
			"received_amount_vnd": invoice.Payment.ReceivedAmountVND,
			"change_amount_vnd":   invoice.Payment.ChangeAmountVND,
			"status":              invoice.Payment.Status,
		},
		Metadata: map[string]any{"actor_type": "SYSTEM", "action": "payment.completed"},
		Priority: 3,
	}); err != nil {
		return err
	}
	return s.outbox.Write(ctx, outbox.WriteEvent{
		RestaurantID:  restaurantID,
		AggregateType: "dining_session",
		AggregateID:   invoice.DiningSessionID,
		EventType:     "dining.session_closed",
		Payload: map[string]any{
			"dining_session_id": invoice.DiningSessionID,
			"invoice_id":        invoice.ID,
			"reason":            "payment_completed",
		},
		Metadata: map[string]any{"actor_type": "SYSTEM", "action": "session.closed"},
		Priority: 3,
	})
}

func (s *HandleWebhook) writePaymentFailed(ctx context.Context, restaurantID uuid.UUID, invoice *domain.Invoice) error {
	if s.outbox == nil || invoice == nil || invoice.Payment == nil {
		return nil
	}
	return s.outbox.Write(ctx, outbox.WriteEvent{
		RestaurantID:  restaurantID,
		AggregateType: "invoice",
		AggregateID:   invoice.ID,
		EventType:     "billing.payment_failed",
		Payload: map[string]any{
			"invoice_id":          invoice.ID,
			"dining_session_id":   invoice.DiningSessionID,
			"payment_id":          invoice.Payment.ID,
			"payment_number":      invoice.Payment.PaymentNumber,
			"payment_method_code": invoice.Payment.MethodCode,
			"amount_vnd":          invoice.Payment.AmountVND,
			"status":              invoice.Payment.Status,
		},
		Metadata: map[string]any{"actor_type": "SYSTEM", "action": "payment.failed"},
		Priority: 4,
	})
}
