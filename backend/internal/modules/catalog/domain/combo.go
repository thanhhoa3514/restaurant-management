package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Combo (set menu) domain types. Combos are a catalog concern (menu content);
// the ordering-time fan-out into parent + component order_items lives in the
// ordering module. Mirrors the MenuItem read/write split.

// ComboComponentWrite is one line of a combo definition as submitted by an admin.
type ComboComponentWrite struct {
	MenuItemID   uuid.UUID
	VariantID    *uuid.UUID
	Quantity     int
	DisplayOrder int
}

// ComboWrite is the full combo definition for create/update.
type ComboWrite struct {
	ID                 uuid.UUID
	Code               string
	Name               string
	Slug               string
	Description        string
	ImageURL           string
	ComboPriceVND      int64
	Status             string
	AvailabilityStatus string
	IsFeatured         bool
	ValidFrom          *time.Time
	ValidTo            *time.Time
	DisplayOrder       int
	ActorID            uuid.UUID
	Version            int
	Components         []ComboComponentWrite
}

// ComboForUpdate is the post-write projection used for audit + command response.
type ComboForUpdate struct {
	ID                 uuid.UUID
	RestaurantID       uuid.UUID
	Code               string
	Name               string
	Slug               string
	Description        string
	ImageURL           string
	ComboPriceVND      int64
	Status             string
	AvailabilityStatus string
	IsFeatured         bool
	ValidFrom          *time.Time
	ValidTo            *time.Time
	DisplayOrder       int
	Version            int
}

// ComboToggle flips availability with optimistic locking (mirrors MenuItemToggle).
type ComboToggle struct {
	ID                 uuid.UUID
	IsAvailable        bool
	AvailabilityStatus *string
	ActorID            uuid.UUID
	Version            int
}

// ComboComponentRead resolves a combo component against the live menu for display.
// Station + UnitPriceVND are carried so the ordering fan-out (parent + component
// order_items) and the admin savings preview both read from one shape.
type ComboComponentRead struct {
	MenuItemID   uuid.UUID  `json:"menu_item_id"`
	VariantID    *uuid.UUID `json:"variant_id,omitempty"`
	Name         string     `json:"name"`
	VariantName  string     `json:"variant_name,omitempty"`
	ImageURL     string     `json:"image_url"`
	Quantity     int        `json:"quantity"`
	DisplayOrder int        `json:"display_order"`
	// Station + UnitPriceVND are omitted from guest JSON (rule #7) via the DTO
	// mapping layer; they are populated here for the ordering module + admin reads.
	Station      string `json:"-"`
	UnitPriceVND int64  `json:"-"`
}

// ComboSummary is a guest-facing combo card (no per-component prices).
type ComboSummary struct {
	ID                 uuid.UUID `json:"id"`
	Code               string    `json:"code"`
	Name               string    `json:"name"`
	Slug               string    `json:"slug"`
	Description        string    `json:"description"`
	ImageURL           string    `json:"image_url"`
	ComboPriceVND      int64     `json:"combo_price_vnd"`
	ReferencePriceVND  int64     `json:"reference_price_vnd"`
	SavingsVND         int64     `json:"savings_vnd"`
	IsFeatured         bool      `json:"is_featured"`
	AvailabilityStatus string    `json:"availability_status"`
	IsAvailable        bool      `json:"is_available"`
}

// ComboDetail is a guest-facing combo detail (summary + component dishes).
type ComboDetail struct {
	ComboSummary
	Components []ComboComponentRead `json:"components"`
}

// ComboAdminSummary is an admin list row (incl. DRAFT/ARCHIVED/expired + version).
type ComboAdminSummary struct {
	ID                 uuid.UUID  `json:"id"`
	Code               string     `json:"code"`
	Name               string     `json:"name"`
	Slug               string     `json:"slug"`
	ImageURL           string     `json:"image_url"`
	ComboPriceVND      int64      `json:"combo_price_vnd"`
	ReferencePriceVND  int64      `json:"reference_price_vnd"`
	SavingsVND         int64      `json:"savings_vnd"`
	Status             string     `json:"status"`
	AvailabilityStatus string     `json:"availability_status"`
	IsAvailable        bool       `json:"is_available"`
	IsFeatured         bool       `json:"is_featured"`
	ValidFrom          *time.Time `json:"valid_from,omitempty"`
	ValidTo            *time.Time `json:"valid_to,omitempty"`
	DisplayOrder       int        `json:"display_order"`
	ComponentCount     int        `json:"component_count"`
	Version            int        `json:"version"`
}

// ComboAdminDetail is an admin detail (with component prices for the savings preview).
type ComboAdminDetail struct {
	ComboAdminSummary
	Description string               `json:"description"`
	Components  []ComboComponentRead `json:"components"`
}

// ComboStats are aggregate counts over the whole admin set (all pages).
type ComboStats struct {
	Total       int
	Published   int
	Unavailable int
}

// ResolvedComponent is a single validated combo component with the live menu
// facts needed to build order_items. Returned by ComboReadRepository.GetComboForOrder.
type ResolvedComponent struct {
	MenuItemID   uuid.UUID
	VariantID    *uuid.UUID
	Name         string
	VariantName  string
	Station      string
	Quantity     int
	UnitPriceVND int64
}

// ComboForOrder is the ordering-module view of a combo at placement time.
type ComboForOrder struct {
	ID                 uuid.UUID
	Code               string
	Name               string
	ComboPriceVND      int64
	Status             string
	AvailabilityStatus string
	ValidFrom          *time.Time
	ValidTo            *time.Time
	// ReferencePriceVND is the live à-la-carte total, frozen onto the parent
	// order_item at order time for the invoice savings caption.
	ReferencePriceVND int64
	Components        []ResolvedComponent
}

type ComboRepository interface {
	// ComponentsResolvable reports whether every (menu_item_id, variant_id) pair
	// belongs to the tenant and resolves to a live menu row (variant, when set,
	// must belong to the same menu item). Used to validate combo definitions.
	ComponentsResolvable(ctx context.Context, restaurantID uuid.UUID, components []ComboComponentWrite) error
	GetComboForUpdate(ctx context.Context, restaurantID, comboID uuid.UUID) (*ComboForUpdate, error)
	CreateCombo(ctx context.Context, restaurantID uuid.UUID, combo ComboWrite) (ComboForUpdate, error)
	UpdateCombo(ctx context.Context, restaurantID uuid.UUID, combo ComboWrite) (ComboForUpdate, error)
	SoftDeleteCombo(ctx context.Context, restaurantID, comboID uuid.UUID, version int, actorID uuid.UUID) (ComboForUpdate, error)
	ToggleComboAvailability(ctx context.Context, restaurantID uuid.UUID, toggle ComboToggle) (ComboForUpdate, error)
	WriteAuditLog(ctx context.Context, audit AuditLogWrite) error
}

type ComboReadRepository interface {
	ListCombos(ctx context.Context, restaurantID uuid.UUID) ([]ComboSummary, error)
	GetCombo(ctx context.Context, restaurantID, comboID uuid.UUID) (*ComboDetail, error)
	ListCombosAdmin(ctx context.Context, restaurantID uuid.UUID, limit, offset int) ([]ComboAdminSummary, ComboStats, error)
	GetComboAdmin(ctx context.Context, restaurantID, comboID uuid.UUID) (*ComboAdminDetail, error)
}
