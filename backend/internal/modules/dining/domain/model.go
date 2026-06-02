package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type SessionStatus string

const (
	SessionActive          SessionStatus = "ACTIVE"
	SessionAwaitingPayment SessionStatus = "AWAITING_PAYMENT"
	SessionClosed          SessionStatus = "CLOSED"
)

type Area struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	Name         string
}
type Table struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	AreaID       uuid.UUID
	Name         string
	QRCode       string
	Version      int
	DeletedAt    *time.Time
}
type DiningSession struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	TableID      uuid.UUID
	Status       SessionStatus
	Version      int
	ClosedAt     *time.Time
}

type Event struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	Type         string
	Payload      any
	OccurredAt   time.Time
}

type DiningRepository interface {
	Save(ctx context.Context, aggregate *DiningSession) error
	Get(ctx context.Context, restaurantID uuid.UUID, id uuid.UUID) (*DiningSession, error)
}

type OutboxWriter interface {
	Write(ctx context.Context, event any) error
}
