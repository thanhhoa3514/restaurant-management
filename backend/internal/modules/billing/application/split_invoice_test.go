package application

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"restaurant-management/internal/shared/apperr"
)

func TestSplitInvoiceRejectsMoreThanSixGroups(t *testing.T) {
	groups := make([]SplitInvoiceGroupRequest, maxSplitInvoiceGroups+1)
	for i := range groups {
		groups[i] = SplitInvoiceGroupRequest{
			Label:        "group",
			OrderItemIDs: []uuid.UUID{uuid.New()},
		}
	}

	_, err := NewSplitInvoice(nil, nil, nil, uuid.New()).Handle(
		context.Background(),
		SplitInvoiceRequest{DiningSessionID: uuid.New(), Groups: groups},
	)
	if !apperr.Is(err, apperr.CodeInvalid) {
		t.Fatalf("expected invalid split group count, got %v", err)
	}
}
