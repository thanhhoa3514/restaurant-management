package application

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/shared/apperr"
)

type AreaDTO struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	DisplayOrder int       `json:"display_order"`
	IsActive     bool      `json:"is_active"`
}

func toAreaDTO(a domain.Area) AreaDTO {
	return AreaDTO{
		ID:           a.ID,
		Name:         a.Name,
		Description:  a.Description,
		DisplayOrder: a.DisplayOrder,
		IsActive:     a.IsActive,
	}
}

// ── List ────────────────────────────────────────────────────────────────────

type ListAreas struct {
	repo                domain.DiningRepository
	defaultRestaurantID uuid.UUID
}

func NewListAreas(repo domain.DiningRepository, defaultRestaurantID uuid.UUID) *ListAreas {
	return &ListAreas{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *ListAreas) Handle(ctx context.Context) ([]AreaDTO, error) {
	rows, err := s.repo.ListAreas(ctx, s.defaultRestaurantID)
	if err != nil {
		return nil, err
	}
	out := make([]AreaDTO, 0, len(rows))
	for _, a := range rows {
		out = append(out, toAreaDTO(a))
	}
	return out, nil
}

type SaveAreaRequest struct {
	AreaID       *uuid.UUID `json:"-"` // nil = create, set = update (from URL param)
	Name         string     `json:"name"`
	Description  string     `json:"description"`
	DisplayOrder int        `json:"display_order"`
	IsActive     *bool      `json:"is_active"` // update-only; create is always active
}

type SaveArea struct {
	tx                  TxRunner
	repo                domain.DiningRepository
	defaultRestaurantID uuid.UUID
}

func NewSaveArea(tx TxRunner, repo domain.DiningRepository, defaultRestaurantID uuid.UUID) *SaveArea {
	return &SaveArea{tx: tx, repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *SaveArea) Handle(ctx context.Context, in SaveAreaRequest) (AreaDTO, error) {
	var out AreaDTO
	restaurantID := s.defaultRestaurantID

	name := strings.TrimSpace(in.Name)
	if name == "" {
		return out, apperr.New(apperr.CodeInvalid, "area name is required")
	}
	if len([]rune(name)) > 100 {
		return out, apperr.New(apperr.CodeInvalid, "area name too long")
	}

	area := &domain.Area{
		RestaurantID: restaurantID,
		Name:         name,
		Description:  strings.TrimSpace(in.Description),
		DisplayOrder: in.DisplayOrder,
		IsActive:     true,
	}

	err := s.tx.Run(ctx, func(ctx context.Context) error {
		if in.AreaID == nil {
			return s.repo.CreateArea(ctx, area)
		}
		area.ID = *in.AreaID
		existing, err := s.repo.FindArea(ctx, restaurantID, area.ID)
		if err != nil {
			return err
		}
		area.IsActive = existing.IsActive
		if in.IsActive != nil {
			area.IsActive = *in.IsActive
		}
		return s.repo.UpdateArea(ctx, area)
	})
	if err != nil {
		return out, err
	}
	return toAreaDTO(*area), nil
}

// ── Delete ──────────────────────────────────────────────────────────────────

type DeleteArea struct {
	tx                  TxRunner
	repo                domain.DiningRepository
	defaultRestaurantID uuid.UUID
}

func NewDeleteArea(tx TxRunner, repo domain.DiningRepository, defaultRestaurantID uuid.UUID) *DeleteArea {
	return &DeleteArea{tx: tx, repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *DeleteArea) Handle(ctx context.Context, areaID uuid.UUID) error {
	restaurantID := s.defaultRestaurantID
	return s.tx.Run(ctx, func(ctx context.Context) error {
		return s.repo.DeleteArea(ctx, restaurantID, areaID)
	})
}
