package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/catalog/domain"
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

type AdminMenuItemDetailDTO struct {
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
	Status             string           `json:"status"`
	IsFeatured         bool             `json:"is_featured"`
	IsSpicy            bool             `json:"is_spicy"`
	Station            string           `json:"station"`
	DisplayOrder       int              `json:"display_order"`
	Version            int              `json:"version"`
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

type GetMenuItem struct {
	repo               domain.MenuReadRepository
	defaultRestaurantID uuid.UUID
}

func NewGetMenuItem(repo domain.MenuReadRepository, defaultRestaurantID uuid.UUID) *GetMenuItem {
	return &GetMenuItem{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *GetMenuItem) Handle(ctx context.Context, req GetMenuItemRequest) (MenuItemDetailDTO, error) {
	var out MenuItemDetailDTO
	item, err := s.repo.GetItem(ctx, s.defaultRestaurantID, req.ItemID)
	if err != nil {
		return out, err
	}
	return toDetailDTO(*item), nil
}

type GetAdminMenuItem struct {
	repo               domain.MenuReadRepository
	defaultRestaurantID uuid.UUID
}

func NewGetAdminMenuItem(repo domain.MenuReadRepository, defaultRestaurantID uuid.UUID) *GetAdminMenuItem {
	return &GetAdminMenuItem{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *GetAdminMenuItem) Handle(ctx context.Context, req GetMenuItemRequest) (AdminMenuItemDetailDTO, error) {
	var out AdminMenuItemDetailDTO
	item, err := s.repo.GetItemAdmin(ctx, s.defaultRestaurantID, req.ItemID)
	if err != nil {
		return out, err
	}
	return toAdminDetailDTO(*item), nil
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

func toAdminDetailDTO(item domain.AdminMenuItemDetail) AdminMenuItemDetailDTO {
	base := toDetailDTO(domain.MenuItemDetail{
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
		Variants:           item.Variants,
		OptionGroups:       item.OptionGroups,
	})
	return AdminMenuItemDetailDTO{
		ID:                 base.ID,
		CategoryID:         base.CategoryID,
		Name:               base.Name,
		Slug:               base.Slug,
		Description:        base.Description,
		ShortDescription:   base.ShortDescription,
		ImageURL:           base.ImageURL,
		Images:             base.Images,
		BasePriceVND:       base.BasePriceVND,
		AvailabilityStatus: base.AvailabilityStatus,
		IsAvailable:        base.IsAvailable,
		Status:             item.Status,
		IsFeatured:         item.IsFeatured,
		IsSpicy:            base.IsSpicy,
		Station:            item.Station,
		DisplayOrder:       item.DisplayOrder,
		Version:            item.Version,
		Variants:           base.Variants,
		OptionGroups:       base.OptionGroups,
	}
}
