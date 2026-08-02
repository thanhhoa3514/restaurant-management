package application

import (
	"testing"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
)

func TestToResponsePreservesTakeawayInvoiceSnapshot(t *testing.T) {
	orderItemID := uuid.New()
	response := toResponse(&domain.Invoice{
		ID: uuid.New(),
		Items: []domain.InvoiceItem{{
			ID:           uuid.New(),
			OrderItemID:  &orderItemID,
			NameSnapshot: "Cơm rang",
			IsTakeaway:   true,
		}},
	})

	if len(response.Invoice.Items) != 1 {
		t.Fatalf("invoice items = %d, want 1", len(response.Invoice.Items))
	}
	if !response.Invoice.Items[0].IsTakeaway {
		t.Fatal("takeaway fulfilment flag was lost from the invoice response")
	}
}
