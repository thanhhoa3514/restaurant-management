package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type InvoiceStatus string

const (
	InvoiceDraft         InvoiceStatus = "DRAFT"
	InvoicePending       InvoiceStatus = "PENDING"
	InvoicePaid          InvoiceStatus = "PAID"
	InvoicePartiallyPaid InvoiceStatus = "PARTIALLY_PAID"
	InvoiceVoid          InvoiceStatus = "VOID"
	InvoiceRefunded      InvoiceStatus = "REFUNDED"
)

type PaymentStatus string

const (
	PaymentPending    PaymentStatus = "PENDING"
	PaymentProcessing PaymentStatus = "PROCESSING"
	PaymentCompleted  PaymentStatus = "COMPLETED"
	PaymentFailed     PaymentStatus = "FAILED"
	PaymentRefunded   PaymentStatus = "REFUNDED"
)

type Invoice struct {
	ID                       uuid.UUID
	RestaurantID             uuid.UUID
	DiningSessionID          uuid.UUID
	InvoiceNumber            string
	Status                   InvoiceStatus
	SubtotalVND              int64
	DiscountAmountVND        int64
	DiscountReason           *string
	ServiceChargeBasisPoints int
	ServiceChargeAmountVND   int64
	VATBasisPoints           int
	VATAmountVND             int64
	RoundingAmountVND        int64
	TotalAmountVND           int64
	PaidAmountVND            int64
	ChangeAmountVND          int64
	IssuedAt                 *time.Time
	PaidAt                   *time.Time
	Version                  int
	Items                    []InvoiceItem
	Payment                  *Payment
}

type InvoiceItem struct {
	ID                uuid.UUID
	InvoiceID         uuid.UUID
	OrderItemID       *uuid.UUID
	NameSnapshot      string
	UnitPriceVND      int64
	Quantity          int
	SubtotalVND       int64
	DiscountAmountVND int64
	TotalAmountVND    int64
}

type Payment struct {
	ID                uuid.UUID
	InvoiceID         uuid.UUID
	DiningSessionID   uuid.UUID
	PaymentNumber     string
	MethodCode        string
	MethodType        string
	AmountVND         int64
	ReceivedAmountVND int64
	ChangeAmountVND   int64
	Status            PaymentStatus
	ReferenceCode     *string
	ProcessedAt       *time.Time
}

type PaymentInput struct {
	InvoiceID         uuid.UUID
	PaymentMethodCode string
	ReceivedAmountVND int64
	ReferenceCode     string
	ProcessedBy       uuid.UUID
}

type InvoiceRepository interface {
	BuildInvoice(ctx context.Context, restaurantID, diningSessionID uuid.UUID) (*Invoice, bool, error)
	AdjustInvoice(ctx context.Context, restaurantID, invoiceID uuid.UUID, discountAmountVND int64, discountReason string) (*Invoice, error)
	ProcessPayment(ctx context.Context, restaurantID uuid.UUID, input PaymentInput) (*Invoice, error)
	LoadInvoice(ctx context.Context, restaurantID, invoiceID uuid.UUID) (*Invoice, error)
}

type OutboxWriter interface {
	Write(ctx context.Context, event any) error
}
