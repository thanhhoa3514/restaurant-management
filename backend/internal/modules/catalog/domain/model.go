package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type MenuCategory struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	Name         string
	Version      int
	DeletedAt    *time.Time
}
type MenuItem struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	CategoryID   uuid.UUID
	Name         string
	Description  string
	PriceVND     int64
	ImageURL     string
	SubImages    []string // Maps to 'images' JSONB in PostgreSQL
	Available    bool
	Version      int
	DeletedAt    *time.Time
}
type ItemOption struct {
	ID            uuid.UUID
	MenuItemID    uuid.UUID
	Name          string
	PriceDeltaVND int64
}

type Event struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	Type         string
	Payload      any
	OccurredAt   time.Time
}

type MenuRepository interface {
	Save(ctx context.Context, aggregate *MenuItem) error
	Get(ctx context.Context, restaurantID uuid.UUID, id uuid.UUID) (*MenuItem, error)
}

type OutboxWriter interface {
	Write(ctx context.Context, event any) error
}
