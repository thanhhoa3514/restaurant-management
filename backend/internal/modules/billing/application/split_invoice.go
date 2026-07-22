package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type SplitInvoiceGroupRequest struct {
	Label        string      `json:"label"`
	OrderItemIDs []uuid.UUID `json:"order_item_ids"`
}

type SplitInvoiceRequest struct {
	DiningSessionID uuid.UUID                  `json:"dining_session_id"`
	Groups          []SplitInvoiceGroupRequest `json:"groups"`
}

type SplitInvoiceResponse struct {
	Invoices []InvoiceDTO `json:"invoices"`
}

type SplitInvoice struct {
	tx                  TxRunner
	repo                domain.InvoiceRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewSplitInvoice(tx TxRunner, repo domain.InvoiceRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *SplitInvoice {
	return &SplitInvoice{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *SplitInvoice) Handle(ctx context.Context, in SplitInvoiceRequest) (SplitInvoiceResponse, error) {
	var out SplitInvoiceResponse
	if in.DiningSessionID == uuidNil {
		return out, apperr.New(apperr.CodeInvalid, "dining_session_id is required")
	}
	if len(in.Groups) < 2 {
		return out, apperr.New(apperr.CodeInvalid, "split requires at least 2 groups")
	}
	groups := make([]domain.SplitGroupInput, 0, len(in.Groups))
	for _, g := range in.Groups {
		groups = append(groups, domain.SplitGroupInput{Label: g.Label, OrderItemIDs: g.OrderItemIDs})
	}
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		invoices, err := s.repo.SplitInvoice(ctx, s.defaultRestaurantID, domain.SplitInvoiceInput{
			DiningSessionID: in.DiningSessionID,
			Groups:          groups,
		})
		if err != nil {
			return err
		}
		ids := make([]uuid.UUID, 0, len(invoices))
		dtos := make([]InvoiceDTO, 0, len(invoices))
		for _, inv := range invoices {
			ids = append(ids, inv.ID)
			dtos = append(dtos, toResponse(inv).Invoice)
		}
		if s.outbox != nil {
			if err := s.outbox.Write(ctx, outbox.WriteEvent{
				RestaurantID:  s.defaultRestaurantID,
				AggregateType: "dining_session",
				AggregateID:   in.DiningSessionID,
				EventType:     "billing.invoice_split",
				Payload: map[string]any{
					"dining_session_id": in.DiningSessionID,
					"invoice_ids":       ids,
					"count":             len(ids),
				},
				Metadata: map[string]any{"actor_type": "STAFF", "action": "invoice.split"},
				Priority: 4,
			}); err != nil {
				return err
			}
		}
		out = SplitInvoiceResponse{Invoices: dtos}
		return nil
	})
	return out, err
}
