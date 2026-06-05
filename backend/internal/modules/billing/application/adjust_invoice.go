package application

import (
	"context"
	"strings"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/platform/tenant"
	"restaurant-management/internal/shared/apperr"
)

type AdjustInvoice struct {
	tx     TxRunner
	repo   domain.InvoiceRepository
	outbox domain.OutboxWriter
}

func NewAdjustInvoice(tx TxRunner, repo domain.InvoiceRepository, outbox domain.OutboxWriter) *AdjustInvoice {
	return &AdjustInvoice{tx: tx, repo: repo, outbox: outbox}
}

func (s *AdjustInvoice) Handle(ctx context.Context, in AdjustInvoiceRequest) (InvoiceResponse, error) {
	var out InvoiceResponse
	if in.InvoiceID == uuidNil {
		return out, apperr.New(apperr.CodeInvalid, "invoice_id is required")
	}
	reason := strings.ToLower(strings.TrimSpace(in.DiscountReason))
	if in.DiscountAmountVND < 0 {
		return out, apperr.New(apperr.CodeInvalid, "discount_amount_vnd must be non-negative")
	}
	if in.DiscountAmountVND == 0 {
		reason = ""
	} else if !validDiscountReason(reason) {
		return out, apperr.New(apperr.CodeInvalid, "discount_reason must be promo, regular, or complaint")
	}
	restaurantID, err := tenant.MustRestaurantID(ctx)
	if err != nil {
		return out, err
	}
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		invoice, err := s.repo.AdjustInvoice(ctx, restaurantID, in.InvoiceID, in.DiscountAmountVND, reason)
		if err != nil {
			return err
		}
		if s.outbox != nil {
			if err := s.outbox.Write(ctx, outbox.WriteEvent{
				RestaurantID:  restaurantID,
				AggregateType: "invoice",
				AggregateID:   invoice.ID,
				EventType:     "billing.invoice_adjusted",
				Payload: map[string]any{
					"invoice_id":          invoice.ID,
					"dining_session_id":   invoice.DiningSessionID,
					"discount_amount_vnd": invoice.DiscountAmountVND,
					"discount_reason":     invoice.DiscountReason,
					"total_amount_vnd":    invoice.TotalAmountVND,
					"invoice_version":     invoice.Version,
				},
				Metadata: map[string]any{"actor_type": "STAFF", "action": "invoice.adjusted"},
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

func validDiscountReason(reason string) bool {
	switch reason {
	case "promo", "regular", "complaint":
		return true
	default:
		return false
	}
}
