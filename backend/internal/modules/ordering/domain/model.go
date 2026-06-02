package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type OrderItemStatus string

const (
	StatusPending      OrderItemStatus = "PENDING"
	StatusAcknowledged OrderItemStatus = "ACKNOWLEDGED"
	StatusPreparing    OrderItemStatus = "PREPARING"
	StatusReady        OrderItemStatus = "READY"
	StatusServed       OrderItemStatus = "SERVED"
)

var allowedTransitions = map[OrderItemStatus][]OrderItemStatus{
	StatusPending: {StatusAcknowledged}, StatusAcknowledged: {StatusPreparing}, StatusPreparing: {StatusReady}, StatusReady: {StatusServed},
}

func (s OrderItemStatus) CanMoveTo(next OrderItemStatus) bool {
	for _, candidate := range allowedTransitions[s] {
		if candidate == next {
			return true
		}
	}
	return false
}

type Order struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	SessionID    uuid.UUID
	Items        []OrderItem
	Version      int
}
type OrderItem struct {
	ID               uuid.UUID
	OrderID          uuid.UUID
	MenuItemID       uuid.UUID
	NameSnapshot     string
	PriceSnapshotVND int64
	Status           OrderItemStatus
	Version          int
}
type CancelRequest struct {
	ID          uuid.UUID
	OrderItemID uuid.UUID
	Reason      string
	Approved    *bool
	CreatedAt   time.Time
}

type Event struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	Type         string
	Payload      any
	OccurredAt   time.Time
}

type OrderRepository interface {
	Save(ctx context.Context, aggregate *Order) error
	Get(ctx context.Context, restaurantID uuid.UUID, id uuid.UUID) (*Order, error)
}

type OutboxWriter interface {
	Write(ctx context.Context, event any) error
}
