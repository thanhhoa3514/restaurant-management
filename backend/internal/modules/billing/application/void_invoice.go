package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type VoidInvoiceRequest struct {
	InvoiceID  uuid.UUID `json:"invoice_id"`
	VoidReason string    `json:"void_reason"`
	ActorID    uuid.UUID `json:"-"`
}

type VoidInvoice struct {
	tx                 TxRunner
	repo               domain.InvoiceRepository
	outbox             domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewVoidInvoice(tx TxRunner, repo domain.InvoiceRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *VoidInvoice {
	return &VoidInvoice{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *VoidInvoice) Handle(ctx context.Context, in VoidInvoiceRequest) (InvoiceResponse, error) {
	var out InvoiceResponse
	if in.InvoiceID == uuidNil {
		return out, apperr.New(apperr.CodeInvalid, "invoice_id is required")
	}
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		invoice, err := s.repo.VoidInvoice(ctx, s.defaultRestaurantID, in.InvoiceID, in.VoidReason)
		if err != nil {
			return err
		}
		if s.outbox != nil {
			if err := s.outbox.Write(ctx, outbox.WriteEvent{
				RestaurantID:  s.defaultRestaurantID,
				AggregateType: "invoice",
				AggregateID:   invoice.ID,
				EventType:     "billing.invoice_voided",
				Payload: map[string]any{
					"invoice_id":        invoice.ID,
					"dining_session_id": invoice.DiningSessionID,
					"void_reason":       in.VoidReason,
					"voided_by":         in.ActorID,
					"invoice_version":   invoice.Version,
				},
				Metadata: map[string]any{"actor_type": "STAFF", "action": "invoice.voided"},
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
