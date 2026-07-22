package application

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type ProcessPayment struct {
	tx                 TxRunner
	repo               domain.InvoiceRepository
	outbox             domain.OutboxWriter
	gateways           *domain.GatewayRegistry
	publicBaseURL      string
	defaultRestaurantID uuid.UUID
}

func NewProcessPayment(tx TxRunner, repo domain.InvoiceRepository, outbox domain.OutboxWriter, gateways *domain.GatewayRegistry, publicBaseURL string, defaultRestaurantID uuid.UUID) *ProcessPayment {
	return &ProcessPayment{tx: tx, repo: repo, outbox: outbox, gateways: gateways, publicBaseURL: strings.TrimRight(publicBaseURL, "/"), defaultRestaurantID: defaultRestaurantID}
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
	if in.ActorID == uuidNil {
		return out, apperr.New(apperr.CodeUnauthorized, "invalid user claim")
	}
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		method, err := s.repo.FindPaymentMethod(ctx, s.defaultRestaurantID, methodCode)
		if err != nil {
			return err
		}
		gateway, hasGateway := s.gateways.Get(method.Code)
		if method.Type == "E_WALLET" && !hasGateway {
			return apperr.New(apperr.CodeNotImplemented, "payment provider not configured")
		}
		if method.Type == "E_WALLET" && hasGateway {
			invoice, err := s.processAsync(ctx, method.Code, gateway, in)
			if err != nil {
				return err
			}
			out = toResponse(invoice)
			return nil
		}

		if in.ReceivedAmountVND <= 0 {
			return apperr.New(apperr.CodeInvalid, "received_amount_vnd must be positive")
		}
		invoice, err := s.repo.ProcessPayment(ctx, s.defaultRestaurantID, domain.PaymentInput{
			InvoiceID:         in.InvoiceID,
			PaymentMethodCode: method.Code,
			ReceivedAmountVND: in.ReceivedAmountVND,
			ReferenceCode:     strings.TrimSpace(in.ReferenceCode),
			ProcessedBy:       in.ActorID,
		})
		if err != nil {
			return err
		}
		if err := s.writePaymentCompleted(ctx, invoice, in.ActorID); err != nil {
			return err
		}
		out = toResponse(invoice)
		return nil
	})
	return out, err
}

func (s *ProcessPayment) processAsync(ctx context.Context, methodCode string, gateway domain.PaymentGateway, in ProcessPaymentRequest) (*domain.Invoice, error) {
	prep, err := s.repo.PrepareAsyncPayment(ctx, s.defaultRestaurantID, domain.AsyncPaymentInput{InvoiceID: in.InvoiceID, PaymentMethodCode: methodCode, ProcessedBy: in.ActorID})
	if err != nil {
		return nil, err
	}
	if !prep.Created {
		return prep.Invoice, nil
	}
	if prep.Payment == nil {
		return nil, apperr.New(apperr.CodeInternal, "processing payment missing")
	}
	ipnURL := s.publicBaseURL + "/api/v1/billing/payments/webhook/" + gateway.Provider()
	if s.publicBaseURL == "" {
		ipnURL = "/api/v1/billing/payments/webhook/" + gateway.Provider()
	}
	result, err := gateway.Initiate(ctx, domain.InitiateInput{
		PaymentNumber: prep.Payment.PaymentNumber,
		AmountVND:     prep.Payment.AmountVND,
		Description:   "Restaurant invoice " + prep.Invoice.InvoiceNumber,
		ReturnURL:     s.publicBaseURL + "/cashier",
		IPNURL:        ipnURL,
	})
	if err != nil {
		return nil, err
	}
	invoice, err := s.repo.AttachGatewayResult(ctx, s.defaultRestaurantID, prep.Payment.ID, result)
	if err != nil {
		return nil, err
	}
	if s.outbox != nil {
		if err := s.outbox.Write(ctx, outbox.WriteEvent{
			RestaurantID:  s.defaultRestaurantID,
			AggregateType: "invoice",
			AggregateID:   invoice.ID,
			EventType:     "billing.payment_initiated",
			Payload: map[string]any{
				"invoice_id":          invoice.ID,
				"dining_session_id":   invoice.DiningSessionID,
				"payment_id":          invoice.Payment.ID,
				"payment_method_code": invoice.Payment.MethodCode,
				"amount_vnd":          invoice.Payment.AmountVND,
			},
			Metadata: map[string]any{"actor_type": "STAFF", "action": "payment.initiated"},
			Priority: 4,
		}); err != nil {
			return nil, err
		}
	}
	return invoice, nil
}

func (s *ProcessPayment) writePaymentCompleted(ctx context.Context, invoice *domain.Invoice, actorID uuid.UUID) error {
	if s.outbox == nil || invoice == nil || invoice.Payment == nil {
		return nil
	}
	if err := s.outbox.Write(ctx, outbox.WriteEvent{
		RestaurantID:  s.defaultRestaurantID,
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
	return s.outbox.Write(ctx, outbox.WriteEvent{
		RestaurantID:  s.defaultRestaurantID,
		AggregateType: "dining_session",
		AggregateID:   invoice.DiningSessionID,
		EventType:     "dining.session_closed",
		Payload: map[string]any{
			"dining_session_id": invoice.DiningSessionID,
			"invoice_id":        invoice.ID,
			"closed_by":         actorID,
			"reason":            "payment_completed",
		},
		Metadata: map[string]any{"actor_type": "STAFF", "action": "session.closed"},
		Priority: 3,
	})
}
