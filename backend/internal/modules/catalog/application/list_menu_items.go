package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/catalog/domain"
)

type ListMenuItemsRequest struct {
	CategoryID *uuid.UUID
}

type MenuItemSummaryDTO struct {
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

type AdminMenuItemSummaryDTO struct {
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
	Status             string    `json:"status"`
	IsFeatured         bool      `json:"is_featured"`
	Station            string    `json:"station"`
	DisplayOrder       int       `json:"display_order"`
	Version            int       `json:"version"`
}

type ListMenuItems struct {
	repo               domain.MenuReadRepository
	defaultRestaurantID uuid.UUID
}

func NewListMenuItems(repo domain.MenuReadRepository, defaultRestaurantID uuid.UUID) *ListMenuItems {
	return &ListMenuItems{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

type ListAdminMenuItems struct {
	repo               domain.MenuReadRepository
	defaultRestaurantID uuid.UUID
}

func NewListAdminMenuItems(repo domain.MenuReadRepository, defaultRestaurantID uuid.UUID) *ListAdminMenuItems {
	return &ListAdminMenuItems{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *ListAdminMenuItems) Handle(ctx context.Context, req ListMenuItemsRequest) ([]AdminMenuItemSummaryDTO, error) {
	rows, err := s.repo.ListItemsAdmin(ctx, s.defaultRestaurantID, req.CategoryID)
	if err != nil {
		return nil, err
	}
	out := make([]AdminMenuItemSummaryDTO, 0, len(rows))
	for _, row := range rows {
		out = append(out, AdminMenuItemSummaryDTO(row))
	}
	return out, nil
}

func (s *ListMenuItems) Handle(ctx context.Context, req ListMenuItemsRequest) ([]MenuItemSummaryDTO, error) {
	rows, err := s.repo.ListItems(ctx, s.defaultRestaurantID, req.CategoryID)
	if err != nil {
		return nil, err
	}
	out := make([]MenuItemSummaryDTO, 0, len(rows))
	for _, row := range rows {
		out = append(out, MenuItemSummaryDTO(row))
	}
	return out, nil
}
