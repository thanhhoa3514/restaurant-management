package application

import (
	"time"

	"github.com/google/uuid"
)

// Combo command DTOs. A combo definition is a set of component dishes bundled at
// a fixed price; combos carry no per-item is_available flag (availability is a
// single status), so the write shape is simpler than MenuItemWrite.

type WriteComboComponentDTO struct {
	MenuItemID   uuid.UUID  `json:"menu_item_id"`
	VariantID    *uuid.UUID `json:"variant_id,omitempty"`
	Quantity     int        `json:"quantity"`
	DisplayOrder int        `json:"display_order"`
}

type CreateComboRequest struct {
	Name               string                   `json:"name"`
	Description        string                   `json:"description"`
	ImageURL           string                   `json:"image_url"`
	ComboPriceVND      int64                    `json:"combo_price_vnd"`
	Status             string                   `json:"status"`
	AvailabilityStatus string                   `json:"availability_status"`
	IsFeatured         bool                     `json:"is_featured"`
	ValidFrom          *time.Time               `json:"valid_from,omitempty"`
	ValidTo            *time.Time               `json:"valid_to,omitempty"`
	DisplayOrder       int                      `json:"display_order"`
	Components         []WriteComboComponentDTO `json:"components"`
	CommandMetadata
}

type UpdateComboRequest struct {
	ID                 uuid.UUID                `json:"id"`
	Name               string                   `json:"name"`
	Description        string                   `json:"description"`
	ImageURL           string                   `json:"image_url"`
	ComboPriceVND      int64                    `json:"combo_price_vnd"`
	Status             string                   `json:"status"`
	AvailabilityStatus string                   `json:"availability_status"`
	IsFeatured         bool                     `json:"is_featured"`
	ValidFrom          *time.Time               `json:"valid_from,omitempty"`
	ValidTo            *time.Time               `json:"valid_to,omitempty"`
	DisplayOrder       int                      `json:"display_order"`
	Version            int                      `json:"version"`
	Components         []WriteComboComponentDTO `json:"components"`
	CommandMetadata
}

type DeleteComboRequest struct {
	ID      uuid.UUID `json:"id"`
	Version int       `json:"version"`
	CommandMetadata
}

type ToggleComboAvailabilityRequest struct {
	ID                 uuid.UUID `json:"id"`
	IsAvailable        bool      `json:"is_available"`
	AvailabilityStatus *string   `json:"availability_status,omitempty"`
	Version            int       `json:"version"`
	CommandMetadata
}

type ComboCommandResponse struct {
	ID      uuid.UUID `json:"id"`
	Status  string    `json:"status"`
	Version int       `json:"version"`
}
