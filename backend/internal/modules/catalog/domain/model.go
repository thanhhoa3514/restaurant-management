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
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Slug         string    `json:"slug"`
	Description  string    `json:"description"`
	ImageURL     string    `json:"image_url"`
	Icon         string    `json:"icon"`
	DisplayOrder int       `json:"display_order"`
}

type MenuItemSummary struct {
	ID                 uuid.UUID `json:"id"`
	CategoryID         uuid.UUID `json:"category_id"`
	Name               string    `json:"name"`
	Slug               string    `json:"slug"`
	ShortDescription   string    `json:"short_description"`
	ImageURL           string    `json:"image_url"`
	BasePriceVND       int64     `json:"base_price_vnd"`
	AvailabilityStatus string    `json:"availability_status"`
	IsAvailable        bool      `json:"is_available"`
	HasVariants        bool      `json:"has_variants"`
	PriceFromVND       *int64    `json:"price_from_vnd"`
}

type MenuItemDetail struct {
	ID                 uuid.UUID         `json:"id"`
	CategoryID         uuid.UUID         `json:"category_id"`
	Name               string            `json:"name"`
	Slug               string            `json:"slug"`
	Description        string            `json:"description"`
	ShortDescription   string            `json:"short_description"`
	ImageURL           string            `json:"image_url"`
	Images             []string          `json:"images"`
	BasePriceVND       int64             `json:"base_price_vnd"`
	AvailabilityStatus string            `json:"availability_status"`
	IsAvailable        bool              `json:"is_available"`
	IsSpicy            bool              `json:"is_spicy"`
	Variants           []VariantRead     `json:"variants"`
	OptionGroups       []OptionGroupRead `json:"option_groups"`
}

type VariantRead struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Unit         string    `json:"unit"`
	PriceVND     int64     `json:"price_vnd"`
	IsDefault    bool      `json:"is_default"`
	IsAvailable  bool      `json:"is_available"`
	DisplayOrder int       `json:"display_order"`
}

type OptionGroupRead struct {
	ID            uuid.UUID    `json:"id"`
	Name          string       `json:"name"`
	Description   string       `json:"description"`
	SelectionType string       `json:"selection_type"`
	IsRequired    bool         `json:"is_required"`
	MinSelections int          `json:"min_selections"`
	MaxSelections *int         `json:"max_selections"`
	DisplayOrder  int          `json:"display_order"`
	Options       []OptionRead `json:"options"`
}

type OptionRead struct {
	ID            uuid.UUID `json:"id"`
	Name          string    `json:"name"`
	PriceDeltaVND int64     `json:"price_delta_vnd"`
	IsDefault     bool      `json:"is_default"`
	IsAvailable   bool      `json:"is_available"`
	DisplayOrder  int       `json:"display_order"`
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
