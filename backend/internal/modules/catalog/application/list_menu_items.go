package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/catalog/domain"
)

type ListMenuItemsRequest struct {
	CategoryID *uuid.UUID
	Page       int
	PageSize   int
}

type MenuPaginationDTO struct {
	Page       int `json:"page"`
	PageSize   int `json:"page_size"`
	TotalItems int `json:"total_items"`
	TotalPages int `json:"total_pages"`
	// Visible/Unavailable are aggregates over the whole filtered set (all pages),
	// so the catalog summary stays correct regardless of the current page.
	Visible     int `json:"visible"`
	Unavailable int `json:"unavailable"`
}

type AdminMenuItemListResponse struct {
	Items      []AdminMenuItemSummaryDTO `json:"items"`
	Pagination MenuPaginationDTO         `json:"pagination"`
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
	IsFeatured         bool      `json:"is_featured"`
	HasVariants        bool      `json:"has_variants"`
	PriceFromVND       *int64    `json:"price_from_vnd"`
	HasRequiredOptions bool     `json:"has_required_options"`
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
	HasRequiredOptions bool     `json:"has_required_options"`
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

const (
	defaultAdminPageSize = 20
	maxAdminPageSize     = 100
)

func (s *ListAdminMenuItems) Handle(ctx context.Context, req ListMenuItemsRequest) (AdminMenuItemListResponse, error) {
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

	rows, stats, err := s.repo.ListItemsAdmin(ctx, s.defaultRestaurantID, req.CategoryID, pageSize, (page-1)*pageSize)
	if err != nil {
		return AdminMenuItemListResponse{}, err
	}
	out := make([]AdminMenuItemSummaryDTO, 0, len(rows))
	for _, row := range rows {
		out = append(out, AdminMenuItemSummaryDTO(row))
	}
	totalPages := 0
	if stats.Total > 0 {
		totalPages = (stats.Total + pageSize - 1) / pageSize
	}
	return AdminMenuItemListResponse{
		Items: out,
		Pagination: MenuPaginationDTO{
			Page:        page,
			PageSize:    pageSize,
			TotalItems:  stats.Total,
			TotalPages:  totalPages,
			Visible:     stats.Visible,
			Unavailable: stats.Unavailable,
		},
	}, nil
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
