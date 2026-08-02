package application

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/shared/apperr"
)

type paidInvoiceRepo struct {
	restaurantID uuid.UUID
	filter       domain.PaidInvoiceFilter
	page         domain.PaidInvoicePage
	detail       *domain.PaidInvoiceDetail
}

func (r *paidInvoiceRepo) ListPaidInvoices(_ context.Context, restaurantID uuid.UUID, filter domain.PaidInvoiceFilter) (domain.PaidInvoicePage, error) {
	r.restaurantID = restaurantID
	r.filter = filter
	return r.page, nil
}

func (r *paidInvoiceRepo) GetPaidInvoice(_ context.Context, restaurantID, _ uuid.UUID) (*domain.PaidInvoiceDetail, error) {
	r.restaurantID = restaurantID
	return r.detail, nil
}

func TestPaidInvoicesListNormalizesFiltersAndMapsAggregates(t *testing.T) {
	restaurantID := uuid.New()
	paidAt := time.Date(2026, 7, 30, 9, 15, 0, 0, time.UTC)
	repo := &paidInvoiceRepo{page: domain.PaidInvoicePage{
		Items: []domain.PaidInvoiceRecord{{
			ID:                 uuid.New(),
			InvoiceNumber:      "INV-001",
			PaidAt:             paidAt,
			TotalAmountVND:     125000,
			PaymentMethodCodes: "cash · sepay",
			PaymentMethodNames: "Tiền mặt · SePay",
		}},
		Summary: domain.PaidInvoiceSummary{
			InvoiceCount:      21,
			TotalRevenueVND:   1250000,
			TotalDiscountVND:  50000,
			AverageInvoiceVND: 59524,
		},
		Total: 21,
	}}

	out, err := NewPaidInvoices(repo, restaurantID).List(context.Background(), PaidInvoiceListRequest{
		Page:              2,
		PageSize:          20,
		Search:            "  INV-001  ",
		From:              "2026-07-01",
		To:                "2026-07-30",
		PaymentMethodCode: " SePay ",
	})
	if err != nil {
		t.Fatal(err)
	}
	if repo.restaurantID != restaurantID {
		t.Fatalf("restaurant scope=%s, want %s", repo.restaurantID, restaurantID)
	}
	if repo.filter.Offset != 20 || repo.filter.Limit != 20 || repo.filter.Search != "INV-001" {
		t.Fatalf("unexpected normalized filter: %+v", repo.filter)
	}
	if repo.filter.PaymentMethodCode != "sepay" {
		t.Fatalf("payment method=%q, want sepay", repo.filter.PaymentMethodCode)
	}
	if repo.filter.From == nil || repo.filter.ToExclusive == nil ||
		repo.filter.ToExclusive.Format(paidInvoiceDateLayout) != "2026-07-31" {
		t.Fatalf("unexpected date range: from=%v to=%v", repo.filter.From, repo.filter.ToExclusive)
	}
	if out.Pagination.TotalPages != 2 || len(out.Items) != 1 {
		t.Fatalf("unexpected response pagination/items: %+v", out)
	}
	if len(out.Items[0].PaymentMethodCodes) != 2 || out.Items[0].PaymentMethodCodes[1] != "sepay" {
		t.Fatalf("unexpected payment method mapping: %+v", out.Items[0].PaymentMethodCodes)
	}
}

func TestPaidInvoicesListRejectsInvalidDateRange(t *testing.T) {
	_, err := NewPaidInvoices(&paidInvoiceRepo{}, uuid.New()).List(context.Background(), PaidInvoiceListRequest{
		From: "2026-07-31",
		To:   "2026-07-01",
	})
	if !apperr.Is(err, apperr.CodeInvalid) {
		t.Fatalf("expected invalid range, got %v", err)
	}
}

func TestPaidInvoicesGetMapsInvoiceAndContext(t *testing.T) {
	restaurantID := uuid.New()
	invoiceID := uuid.New()
	repo := &paidInvoiceRepo{detail: &domain.PaidInvoiceDetail{
		Invoice: &domain.Invoice{
			ID:            invoiceID,
			InvoiceNumber: "INV-001",
			Status:        domain.InvoicePaid,
			Items:         []domain.InvoiceItem{},
			Payments:      []domain.Payment{},
		},
		Context: domain.PaidInvoiceContext{
			SessionReference: "SES-001",
			TableLabel:       "Bàn 01",
			CustomerName:     "Nguyễn An",
		},
	}}

	out, err := NewPaidInvoices(repo, restaurantID).Get(context.Background(), invoiceID)
	if err != nil {
		t.Fatal(err)
	}
	if out.Invoice.ID != invoiceID || out.Context.TableLabel != "Bàn 01" {
		t.Fatalf("unexpected detail response: %+v", out)
	}
}
