package application

import (
	"context"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/platform/tenant"
	"restaurant-management/internal/shared/apperr"
)

type BuildInvoice struct {
	tx     TxRunner
	repo   domain.InvoiceRepository
	outbox domain.OutboxWriter
}

func NewBuildInvoice(tx TxRunner, repo domain.InvoiceRepository, outbox domain.OutboxWriter) *BuildInvoice {
	return &BuildInvoice{tx: tx, repo: repo, outbox: outbox}
}

func (s *BuildInvoice) Handle(ctx context.Context, in BuildInvoiceRequest) (InvoiceResponse, error) {
	var out InvoiceResponse
	if in.DiningSessionID == uuidNil {
		return out, apperr.New(apperr.CodeInvalid, "dining_session_id is required")
	}
	restaurantID, err := tenant.MustRestaurantID(ctx)
	if err != nil {
		return out, err
	}
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		invoice, created, err := s.repo.BuildInvoice(ctx, restaurantID, in.DiningSessionID)
		if err != nil {
			return err
		}
		if created && s.outbox != nil {
			if err := s.outbox.Write(ctx, outbox.WriteEvent{
				RestaurantID:  restaurantID,
				AggregateType: "invoice",
				AggregateID:   invoice.ID,
				EventType:     "billing.invoice_built",
				Payload: map[string]any{
					"invoice_id":        invoice.ID,
					"invoice_number":    invoice.InvoiceNumber,
					"dining_session_id": invoice.DiningSessionID,
					"total_amount_vnd":  invoice.TotalAmountVND,
				},
				Metadata: map[string]any{"actor_type": "STAFF", "action": "invoice.built"},
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
