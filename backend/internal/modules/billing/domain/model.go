package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type PaymentStatus string

const (
	PaymentPending   PaymentStatus = "PENDING"
	PaymentConfirmed PaymentStatus = "CONFIRMED"
	PaymentFailed    PaymentStatus = "FAILED"
)

type Invoice struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	SessionID    uuid.UUID
	TotalVND     int64
	Version      int
}
type InvoiceItem struct {
	ID               uuid.UUID
	InvoiceID        uuid.UUID
	NameSnapshot     string
	PriceSnapshotVND int64
	Quantity         int
}
type Discount struct {
	ID        uuid.UUID
	InvoiceID uuid.UUID
	AmountVND int64
	Reason    string
}
type Payment struct {
	ID         uuid.UUID
	InvoiceID  uuid.UUID
	AmountVND  int64
	Status     PaymentStatus
	GatewayRef string
}

type Event struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	Type         string
	Payload      any
	OccurredAt   time.Time
}

type InvoiceRepository interface {
	Save(ctx context.Context, aggregate *Invoice) error
	Get(ctx context.Context, restaurantID uuid.UUID, id uuid.UUID) (*Invoice, error)
}

type OutboxWriter interface {
	Write(ctx context.Context, event any) error
}
