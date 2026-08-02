package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type PaidInvoiceFilter struct {
	Search            string
	From              *time.Time
	ToExclusive       *time.Time
	PaymentMethodCode string
	Limit             int
	Offset            int
}

type PaidInvoiceRecord struct {
	ID                 uuid.UUID
	InvoiceNumber      string
	PaidAt             time.Time
	SubtotalVND        int64
	DiscountAmountVND  int64
	ServiceChargeVND   int64
	VATAmountVND       int64
	TotalAmountVND     int64
	PaidAmountVND      int64
	SessionReference   string
	TableLabel         string
	CustomerName       string
	ItemCount          int
	PaymentMethodCodes string
	PaymentMethodNames string
}

type PaidInvoiceSummary struct {
	InvoiceCount      int64
	TotalRevenueVND   int64
	TotalDiscountVND  int64
	AverageInvoiceVND int64
}

type PaidInvoicePaymentMethod struct {
	Code string
	Name string
}

type PaidInvoicePage struct {
	Items          []PaidInvoiceRecord
	Summary        PaidInvoiceSummary
	PaymentMethods []PaidInvoicePaymentMethod
	Total          int64
}

type PaidInvoiceContext struct {
	SessionReference string
	TableLabel       string
	CustomerName     string
	CustomerPhone    string
}

type PaidInvoiceDetail struct {
	Invoice *Invoice
	Context PaidInvoiceContext
}

type PaidInvoiceRepository interface {
	ListPaidInvoices(ctx context.Context, restaurantID uuid.UUID, filter PaidInvoiceFilter) (PaidInvoicePage, error)
	GetPaidInvoice(ctx context.Context, restaurantID, invoiceID uuid.UUID) (*PaidInvoiceDetail, error)
}
