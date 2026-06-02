package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/catalog/domain"
	"restaurant-management/internal/platform/tenant"
	"restaurant-management/internal/shared/apperr"
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

type ListMenuItems struct{ repo domain.MenuReadRepository }

func NewListMenuItems(repo domain.MenuReadRepository) *ListMenuItems {
	return &ListMenuItems{repo: repo}
}

func (s *ListMenuItems) Handle(ctx context.Context, req ListMenuItemsRequest) ([]MenuItemSummaryDTO, error) {
	restaurantID, err := tenant.MustRestaurantID(ctx)
	if err != nil {
		return nil, apperr.New(apperr.CodeUnauthorized, "missing restaurant tenant")
	}
	rows, err := s.repo.ListItems(ctx, restaurantID, req.CategoryID)
	if err != nil {
		return nil, err
	}
	out := make([]MenuItemSummaryDTO, 0, len(rows))
	for _, row := range rows {
		out = append(out, MenuItemSummaryDTO(row))
	}
	return out, nil
}
