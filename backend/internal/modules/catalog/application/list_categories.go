package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/catalog/domain"
	"restaurant-management/internal/platform/tenant"
	"restaurant-management/internal/shared/apperr"
)

type CategoryDTO struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Slug         string    `json:"slug"`
	Description  string    `json:"description"`
	ImageURL     string    `json:"image_url"`
	Icon         string    `json:"icon"`
	DisplayOrder int       `json:"display_order"`
}

type ListCategories struct{ repo domain.MenuReadRepository }

func NewListCategories(repo domain.MenuReadRepository) *ListCategories {
	return &ListCategories{repo: repo}
}

func (s *ListCategories) Handle(ctx context.Context) ([]CategoryDTO, error) {
	restaurantID, err := tenant.MustRestaurantID(ctx)
	if err != nil {
		return nil, apperr.New(apperr.CodeUnauthorized, "missing restaurant tenant")
	}
	rows, err := s.repo.ListCategories(ctx, restaurantID)
	if err != nil {
		return nil, err
	}
	out := make([]CategoryDTO, 0, len(rows))
	for _, row := range rows {
		out = append(out, CategoryDTO(row))
	}
	return out, nil
}
