package application

import "github.com/google/uuid"

type Input struct {
	RestaurantID uuid.UUID `json:"-"` // from auth tenant context, not client body
}
type Output struct {
	ID     uuid.UUID `json:"id"`
	Status string    `json:"status"`
}

type CommandMetadata struct {
	ActorID   uuid.UUID `json:"-"`
	IPAddress string    `json:"-"`
	UserAgent string    `json:"-"`
	TraceID   string    `json:"-"`
}

type WriteVariantDTO struct {
	ID           *uuid.UUID `json:"id,omitempty"`
	Name         string     `json:"name"`
	Unit         *string    `json:"unit,omitempty"`
	PriceVND     int64      `json:"price_vnd"`
	IsDefault    bool       `json:"is_default"`
	IsAvailable  bool       `json:"is_available"`
	DisplayOrder int        `json:"display_order"`
}

type WriteOptionDTO struct {
	ID            *uuid.UUID `json:"id,omitempty"`
	Name          string     `json:"name"`
	PriceDeltaVND int64      `json:"price_delta_vnd"`
	IsDefault     bool       `json:"is_default"`
	IsAvailable   bool       `json:"is_available"`
	DisplayOrder  int        `json:"display_order"`
}

type WriteOptionGroupDTO struct {
	ID            *uuid.UUID       `json:"id,omitempty"`
	Name          string           `json:"name"`
	Description   *string          `json:"description,omitempty"`
	SelectionType string           `json:"selection_type"`
	IsRequired    bool             `json:"is_required"`
	MinSelections int              `json:"min_selections"`
	MaxSelections *int             `json:"max_selections,omitempty"`
	DisplayOrder  int              `json:"display_order"`
	Options       []WriteOptionDTO `json:"options"`
}

type CreateMenuItemRequest struct {
	CategoryID         uuid.UUID             `json:"category_id"`
	Name               string                `json:"name"`
	Description        string                `json:"description"`
	ShortDescription   string                `json:"short_description"`
	BasePriceVND       int64                 `json:"base_price_vnd"`
	ImageURL           string                `json:"image_url"`
	IsAvailable        bool                  `json:"is_available"`
	AvailabilityStatus string                `json:"availability_status"`
	Status             string                `json:"status"`
	IsFeatured         bool                  `json:"is_featured"`
	IsSpicy            bool                  `json:"is_spicy"`
	Station            string                `json:"station"`
	DisplayOrder       int                   `json:"display_order"`
	Variants           []WriteVariantDTO     `json:"variants"`
	OptionGroups       []WriteOptionGroupDTO `json:"option_groups"`
	CommandMetadata
}

type UpdateMenuItemRequest struct {
	ID                 uuid.UUID             `json:"id"`
	CategoryID         uuid.UUID             `json:"category_id"`
	Name               string                `json:"name"`
	Description        string                `json:"description"`
	ShortDescription   string                `json:"short_description"`
	BasePriceVND       int64                 `json:"base_price_vnd"`
	ImageURL           string                `json:"image_url"`
	IsAvailable        bool                  `json:"is_available"`
	AvailabilityStatus string                `json:"availability_status"`
	Status             string                `json:"status"`
	IsFeatured         bool                  `json:"is_featured"`
	IsSpicy            bool                  `json:"is_spicy"`
	Station            string                `json:"station"`
	DisplayOrder       int                   `json:"display_order"`
	Version            int                   `json:"version"`
	Variants           []WriteVariantDTO     `json:"variants"`
	OptionGroups       []WriteOptionGroupDTO `json:"option_groups"`
	CommandMetadata
}

type DeleteMenuItemRequest struct {
	ID      uuid.UUID `json:"id"`
	Version int       `json:"version"`
	CommandMetadata
}

type ToggleAvailabilityRequest struct {
	ID                 uuid.UUID `json:"id"`
	IsAvailable        bool      `json:"is_available"`
	AvailabilityStatus *string   `json:"availability_status,omitempty"`
	Version            int       `json:"version"`
	CommandMetadata
}

type MenuItemCommandResponse struct {
	ID      uuid.UUID `json:"id"`
	Status  string    `json:"status"`
	Version int       `json:"version"`
}
