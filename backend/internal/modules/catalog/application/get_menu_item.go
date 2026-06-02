package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/catalog/domain"
	"restaurant-management/internal/platform/tenant"
	"restaurant-management/internal/shared/apperr"
)

type GetMenuItemRequest struct {
	ItemID uuid.UUID
}

type MenuItemDetailDTO struct {
	ID                 uuid.UUID        `json:"id"`
	CategoryID         uuid.UUID        `json:"category_id"`
	Name               string           `json:"name"`
	Slug               string           `json:"slug"`
	Description        string           `json:"description"`
	ShortDescription   string           `json:"short_description"`
	ImageURL           string           `json:"image_url"`
	Images             []string         `json:"images"`
	BasePriceVND       int64            `json:"base_price_vnd"`
	AvailabilityStatus string           `json:"availability_status"`
	IsAvailable        bool             `json:"is_available"`
	IsSpicy            bool             `json:"is_spicy"`
	Variants           []VariantDTO     `json:"variants"`
	OptionGroups       []OptionGroupDTO `json:"option_groups"`
}

type VariantDTO struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Unit         string    `json:"unit"`
	PriceVND     int64     `json:"price_vnd"`
	IsDefault    bool      `json:"is_default"`
	IsAvailable  bool      `json:"is_available"`
	DisplayOrder int       `json:"display_order"`
}

type OptionGroupDTO struct {
	ID            uuid.UUID   `json:"id"`
	Name          string      `json:"name"`
	Description   string      `json:"description"`
	SelectionType string      `json:"selection_type"`
	IsRequired    bool        `json:"is_required"`
	MinSelections int         `json:"min_selections"`
	MaxSelections *int        `json:"max_selections"`
	DisplayOrder  int         `json:"display_order"`
	Options       []OptionDTO `json:"options"`
}

type OptionDTO struct {
	ID            uuid.UUID `json:"id"`
	Name          string    `json:"name"`
	PriceDeltaVND int64     `json:"price_delta_vnd"`
	IsDefault     bool      `json:"is_default"`
	IsAvailable   bool      `json:"is_available"`
	DisplayOrder  int       `json:"display_order"`
}

type GetMenuItem struct{ repo domain.MenuReadRepository }

func NewGetMenuItem(repo domain.MenuReadRepository) *GetMenuItem { return &GetMenuItem{repo: repo} }

func (s *GetMenuItem) Handle(ctx context.Context, req GetMenuItemRequest) (MenuItemDetailDTO, error) {
	var out MenuItemDetailDTO
	restaurantID, err := tenant.MustRestaurantID(ctx)
	if err != nil {
		return out, apperr.New(apperr.CodeUnauthorized, "missing restaurant tenant")
	}
	item, err := s.repo.GetItem(ctx, restaurantID, req.ItemID)
	if err != nil {
		return out, err
	}
	return toDetailDTO(*item), nil
}

func toDetailDTO(item domain.MenuItemDetail) MenuItemDetailDTO {
	variants := make([]VariantDTO, 0, len(item.Variants))
	for _, v := range item.Variants {
		variants = append(variants, VariantDTO(v))
	}
	groups := make([]OptionGroupDTO, 0, len(item.OptionGroups))
	for _, g := range item.OptionGroups {
		options := make([]OptionDTO, 0, len(g.Options))
		for _, o := range g.Options {
			options = append(options, OptionDTO(o))
		}
		groups = append(groups, OptionGroupDTO{
			ID:            g.ID,
			Name:          g.Name,
			Description:   g.Description,
			SelectionType: g.SelectionType,
			IsRequired:    g.IsRequired,
			MinSelections: g.MinSelections,
			MaxSelections: g.MaxSelections,
			DisplayOrder:  g.DisplayOrder,
			Options:       options,
		})
	}
	return MenuItemDetailDTO{
		ID:                 item.ID,
		CategoryID:         item.CategoryID,
		Name:               item.Name,
		Slug:               item.Slug,
		Description:        item.Description,
		ShortDescription:   item.ShortDescription,
		ImageURL:           item.ImageURL,
		Images:             item.Images,
		BasePriceVND:       item.BasePriceVND,
		AvailabilityStatus: item.AvailabilityStatus,
		IsAvailable:        item.IsAvailable,
		IsSpicy:            item.IsSpicy,
		Variants:           variants,
		OptionGroups:       groups,
	}
}
