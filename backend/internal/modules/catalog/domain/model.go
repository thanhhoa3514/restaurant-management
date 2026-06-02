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

type CategoryRead struct {
	ID           uuid.UUID
	Name         string
	Slug         string
	Description  string
	ImageURL     string
	Icon         string
	DisplayOrder int
}

type MenuItemSummary struct {
	ID                 uuid.UUID
	CategoryID         uuid.UUID
	Name               string
	Slug               string
	ShortDescription   string
	ImageURL           string
	BasePriceVND       int64
	AvailabilityStatus string
	IsAvailable        bool
	HasVariants        bool
	PriceFromVND       *int64
}

type MenuItemDetail struct {
	ID                 uuid.UUID
	CategoryID         uuid.UUID
	Name               string
	Slug               string
	Description        string
	ShortDescription   string
	ImageURL           string
	Images             []string
	BasePriceVND       int64
	AvailabilityStatus string
	IsAvailable        bool
	IsSpicy            bool
	Variants           []VariantRead
	OptionGroups       []OptionGroupRead
}

type VariantRead struct {
	ID           uuid.UUID
	Name         string
	Unit         string
	PriceVND     int64
	IsDefault    bool
	IsAvailable  bool
	DisplayOrder int
}

type OptionGroupRead struct {
	ID            uuid.UUID
	Name          string
	Description   string
	SelectionType string
	IsRequired    bool
	MinSelections int
	MaxSelections *int
	DisplayOrder  int
	Options       []OptionRead
}

type OptionRead struct {
	ID            uuid.UUID
	Name          string
	PriceDeltaVND int64
	IsDefault     bool
	IsAvailable   bool
	DisplayOrder  int
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

type MenuReadRepository interface {
	ListCategories(ctx context.Context, restaurantID uuid.UUID) ([]CategoryRead, error)
	ListItems(ctx context.Context, restaurantID uuid.UUID, categoryID *uuid.UUID) ([]MenuItemSummary, error)
	GetItem(ctx context.Context, restaurantID uuid.UUID, itemID uuid.UUID) (*MenuItemDetail, error)
}

type OutboxWriter interface {
	Write(ctx context.Context, event any) error
}
