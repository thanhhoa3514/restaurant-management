package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/catalog/domain"
)

// ---- guest reads ----

type GetComboRequest struct {
	ComboID uuid.UUID
}

type ListCombos struct {
	repo                domain.ComboReadRepository
	defaultRestaurantID uuid.UUID
}

func NewListCombos(repo domain.ComboReadRepository, defaultRestaurantID uuid.UUID) *ListCombos {
	return &ListCombos{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *ListCombos) Handle(ctx context.Context) ([]domain.ComboSummary, error) {
	return s.repo.ListCombos(ctx, s.defaultRestaurantID)
}

type GetCombo struct {
	repo                domain.ComboReadRepository
	defaultRestaurantID uuid.UUID
}

func NewGetCombo(repo domain.ComboReadRepository, defaultRestaurantID uuid.UUID) *GetCombo {
	return &GetCombo{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *GetCombo) Handle(ctx context.Context, req GetComboRequest) (domain.ComboDetail, error) {
	combo, err := s.repo.GetCombo(ctx, s.defaultRestaurantID, req.ComboID)
	if err != nil {
		return domain.ComboDetail{}, err
	}
	return *combo, nil
}

// ---- admin reads ----

type AdminComboListResponse struct {
	Items      []domain.ComboAdminSummary `json:"items"`
	Pagination MenuPaginationDTO          `json:"pagination"`
}

// AdminComboComponentDTO exposes the per-component à-la-carte price (hidden from
// guests) so the admin UI can show the savings breakdown.
type AdminComboComponentDTO struct {
	MenuItemID   uuid.UUID  `json:"menu_item_id"`
	VariantID    *uuid.UUID `json:"variant_id,omitempty"`
	Name         string     `json:"name"`
	VariantName  string     `json:"variant_name,omitempty"`
	ImageURL     string     `json:"image_url"`
	Station      string     `json:"station"`
	Quantity     int        `json:"quantity"`
	UnitPriceVND int64      `json:"unit_price_vnd"`
	DisplayOrder int        `json:"display_order"`
}

type AdminComboDetailDTO struct {
	domain.ComboAdminSummary
	Description string                   `json:"description"`
	Components  []AdminComboComponentDTO `json:"components"`
}

type ListCombosAdmin struct {
	repo                domain.ComboReadRepository
	defaultRestaurantID uuid.UUID
}

func NewListCombosAdmin(repo domain.ComboReadRepository, defaultRestaurantID uuid.UUID) *ListCombosAdmin {
	return &ListCombosAdmin{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

type ListCombosRequest struct {
	Page     int
	PageSize int
}

func (s *ListCombosAdmin) Handle(ctx context.Context, req ListCombosRequest) (AdminComboListResponse, error) {
	page := req.Page
	if page <= 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = defaultAdminPageSize
	}
	if pageSize > maxAdminPageSize {
		pageSize = maxAdminPageSize
	}
	rows, stats, err := s.repo.ListCombosAdmin(ctx, s.defaultRestaurantID, pageSize, (page-1)*pageSize)
	if err != nil {
		return AdminComboListResponse{}, err
	}
	if rows == nil {
		rows = []domain.ComboAdminSummary{}
	}
	totalPages := 0
	if stats.Total > 0 {
		totalPages = (stats.Total + pageSize - 1) / pageSize
	}
	return AdminComboListResponse{
		Items: rows,
		Pagination: MenuPaginationDTO{
			Page:        page,
			PageSize:    pageSize,
			TotalItems:  stats.Total,
			TotalPages:  totalPages,
			Visible:     stats.Published,
			Unavailable: stats.Unavailable,
		},
	}, nil
}

type GetComboAdmin struct {
	repo                domain.ComboReadRepository
	defaultRestaurantID uuid.UUID
}

func NewGetComboAdmin(repo domain.ComboReadRepository, defaultRestaurantID uuid.UUID) *GetComboAdmin {
	return &GetComboAdmin{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *GetComboAdmin) Handle(ctx context.Context, req GetComboRequest) (AdminComboDetailDTO, error) {
	combo, err := s.repo.GetComboAdmin(ctx, s.defaultRestaurantID, req.ComboID)
	if err != nil {
		return AdminComboDetailDTO{}, err
	}
	components := make([]AdminComboComponentDTO, 0, len(combo.Components))
	for _, c := range combo.Components {
		components = append(components, AdminComboComponentDTO{
			MenuItemID:   c.MenuItemID,
			VariantID:    c.VariantID,
			Name:         c.Name,
			VariantName:  c.VariantName,
			ImageURL:     c.ImageURL,
			Station:      c.Station,
			Quantity:     c.Quantity,
			UnitPriceVND: c.UnitPriceVND,
			DisplayOrder: c.DisplayOrder,
		})
	}
	return AdminComboDetailDTO{
		ComboAdminSummary: combo.ComboAdminSummary,
		Description:       combo.Description,
		Components:        components,
	}, nil
}
