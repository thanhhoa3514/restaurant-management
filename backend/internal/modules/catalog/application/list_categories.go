package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/catalog/domain"
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

type ListCategories struct {
	repo               domain.MenuReadRepository
	defaultRestaurantID uuid.UUID
}

func NewListCategories(repo domain.MenuReadRepository, defaultRestaurantID uuid.UUID) *ListCategories {
	return &ListCategories{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *ListCategories) Handle(ctx context.Context) ([]CategoryDTO, error) {
	rows, err := s.repo.ListCategories(ctx, s.defaultRestaurantID)
	if err != nil {
		return nil, err
	}
	out := make([]CategoryDTO, 0, len(rows))
	for _, row := range rows {
		out = append(out, CategoryDTO(row))
	}
	return out, nil
}
