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

type CreateMenuItemRequest struct {
	CategoryID         uuid.UUID `json:"category_id"`
	Name               string    `json:"name"`
	Description        string    `json:"description"`
	ShortDescription   string    `json:"short_description"`
	BasePriceVND       int64     `json:"base_price_vnd"`
	ImageURL           string    `json:"image_url"`
	IsAvailable        bool      `json:"is_available"`
	AvailabilityStatus string    `json:"availability_status"`
	Status             string    `json:"status"`
	IsFeatured         bool      `json:"is_featured"`
	IsSpicy            bool      `json:"is_spicy"`
	Station            string    `json:"station"`
	DisplayOrder       int       `json:"display_order"`
	CommandMetadata
}

type UpdateMenuItemRequest struct {
	ID                 uuid.UUID `json:"id"`
	CategoryID         uuid.UUID `json:"category_id"`
	Name               string    `json:"name"`
	Description        string    `json:"description"`
	ShortDescription   string    `json:"short_description"`
	BasePriceVND       int64     `json:"base_price_vnd"`
	ImageURL           string    `json:"image_url"`
	IsAvailable        bool      `json:"is_available"`
	AvailabilityStatus string    `json:"availability_status"`
	Status             string    `json:"status"`
	IsFeatured         bool      `json:"is_featured"`
	IsSpicy            bool      `json:"is_spicy"`
	Station            string    `json:"station"`
	DisplayOrder       int       `json:"display_order"`
	Version            int       `json:"version"`
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
