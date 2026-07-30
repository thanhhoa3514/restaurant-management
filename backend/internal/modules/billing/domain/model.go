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
	Payment                  *Payment  // latest/completed payment (backward compat)
	Payments                 []Payment // all payments (supports multi-method)
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
	ID                   uuid.UUID
	InvoiceID            uuid.UUID
	DiningSessionID      uuid.UUID
	PaymentNumber        string
	MethodCode           string
	MethodType           string
	AmountVND            int64
	ReceivedAmountVND    int64
	ChangeAmountVND      int64
	Status               PaymentStatus
	ReferenceCode        *string
	GatewayTransactionID *string
	PayURL               string
	Deeplink             string
	QRCodeURL            string
	ProcessedAt          *time.Time
}

type PaymentMethod struct {
	ID                uuid.UUID
	Code              string
	Type              string
	RequiresReference bool
}

type PaymentInput struct {
	InvoiceID         uuid.UUID
	PaymentMethodCode string
	ReceivedAmountVND int64
	ReferenceCode     string
	ProcessedBy       uuid.UUID
}

type PartialPaymentInput struct {
	InvoiceID         uuid.UUID
	PaymentMethodCode string
	ReceivedAmountVND int64
	ReferenceCode     string
	ProcessedBy       uuid.UUID
}

type AsyncPaymentInput struct {
	InvoiceID         uuid.UUID
	PaymentMethodCode string
	ProcessedBy       uuid.UUID
}

type AsyncPaymentPreparation struct {
	Invoice *Invoice
	Payment *Payment
	Created bool
}

type SplitGroupInput struct {
	Label        string
	OrderItemIDs []uuid.UUID
}

type SplitInvoiceInput struct {
	DiningSessionID uuid.UUID
	Groups          []SplitGroupInput
}

type WebhookPayment struct {
	ID               uuid.UUID
	RestaurantID     uuid.UUID
	InvoiceID        uuid.UUID
	DiningSessionID  uuid.UUID
	PaymentNumber    string
	AmountVND        int64
	WebhookAmountVND int64
	Status           PaymentStatus
}

type InvoiceRepository interface {
	BuildInvoice(ctx context.Context, restaurantID, diningSessionID uuid.UUID) (*Invoice, bool, error)
	AdjustInvoice(ctx context.Context, restaurantID, invoiceID uuid.UUID, discountAmountVND int64, discountReason string) (*Invoice, error)
	VoidInvoice(ctx context.Context, restaurantID, invoiceID uuid.UUID, reason string) (*Invoice, error)
	FindPaymentMethod(ctx context.Context, restaurantID uuid.UUID, code string) (*PaymentMethod, error)
	ProcessPayment(ctx context.Context, restaurantID uuid.UUID, input PaymentInput) (*Invoice, error)
	ProcessPartialPayment(ctx context.Context, restaurantID uuid.UUID, input PartialPaymentInput) (*Invoice, error)
	PrepareAsyncPayment(ctx context.Context, restaurantID uuid.UUID, input AsyncPaymentInput) (*AsyncPaymentPreparation, error)
	AttachGatewayResult(ctx context.Context, restaurantID, paymentID uuid.UUID, result InitiateResult) (*Invoice, error)
	FindWebhookPayment(ctx context.Context, gatewayTransactionID, orderRef string) (*WebhookPayment, error)
	InsertWebhookEvent(ctx context.Context, restaurantID uuid.UUID, provider, eventID string, paymentID uuid.UUID, payload any) (uuid.UUID, bool, error)
	CompleteWebhookPayment(ctx context.Context, restaurantID, paymentID uuid.UUID, event WebhookEvent) (*Invoice, error)
	FailWebhookPayment(ctx context.Context, restaurantID, paymentID uuid.UUID, event WebhookEvent) (*Invoice, error)
	MarkWebhookProcessed(ctx context.Context, eventRowID uuid.UUID) error
	MarkWebhookError(ctx context.Context, eventRowID uuid.UUID, message string) error
	LoadInvoice(ctx context.Context, restaurantID, invoiceID uuid.UUID) (*Invoice, error)
	SplitInvoice(ctx context.Context, restaurantID uuid.UUID, input SplitInvoiceInput) ([]*Invoice, error)
	ListSessionInvoices(ctx context.Context, restaurantID, diningSessionID uuid.UUID) ([]*Invoice, error)
}

type OutboxWriter interface {
	Write(ctx context.Context, event any) error
}
