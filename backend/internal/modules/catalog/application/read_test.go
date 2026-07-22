package application

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"restaurant-management/internal/modules/catalog/domain"
	"restaurant-management/internal/shared/apperr"
)

type fakeReadRepo struct {
	categories []domain.CategoryRead
	items      []domain.MenuItemSummary
	item       *domain.MenuItemDetail
	adminItems []domain.AdminMenuItemSummary
	adminItem  *domain.AdminMenuItemDetail
	err        error
	gotCatID   *uuid.UUID
}

func (r *fakeReadRepo) ListCategories(context.Context, uuid.UUID) ([]domain.CategoryRead, error) {
	return r.categories, r.err
}
func (r *fakeReadRepo) ListItems(_ context.Context, _ uuid.UUID, categoryID *uuid.UUID) ([]domain.MenuItemSummary, error) {
	r.gotCatID = categoryID
	return r.items, r.err
}
func (r *fakeReadRepo) GetItem(context.Context, uuid.UUID, uuid.UUID) (*domain.MenuItemDetail, error) {
	if r.err != nil {
		return nil, r.err
	}
	return r.item, nil
}
func (r *fakeReadRepo) ListItemsAdmin(_ context.Context, _ uuid.UUID, categoryID *uuid.UUID) ([]domain.AdminMenuItemSummary, error) {
	r.gotCatID = categoryID
	return r.adminItems, r.err
}
func (r *fakeReadRepo) GetItemAdmin(context.Context, uuid.UUID, uuid.UUID) (*domain.AdminMenuItemDetail, error) {
	if r.err != nil {
		return nil, r.err
	}
	return r.adminItem, nil
}

func catalogTenantCtx() context.Context {
	return context.Background()
}

func TestListCategoriesReturnsOrderedRowsAndEmpty(t *testing.T) {
	repo := &fakeReadRepo{categories: []domain.CategoryRead{{ID: uuid.New(), Name: "A", Slug: "a", DisplayOrder: 1}}}
	out, err := NewListCategories(repo, uuid.Nil).Handle(catalogTenantCtx())
	require.NoError(t, err)
	require.Len(t, out, 1)
	require.Equal(t, "A", out[0].Name)

	repo = &fakeReadRepo{}
	out, err = NewListCategories(repo, uuid.Nil).Handle(catalogTenantCtx())
	require.NoError(t, err)
	require.Empty(t, out)
}

func TestListMenuItemsCategoryAndVariantSummary(t *testing.T) {
	catID := uuid.New()
	price := int64(120000)
	repo := &fakeReadRepo{items: []domain.MenuItemSummary{{ID: uuid.New(), CategoryID: catID, Name: "Hotpot", Slug: "hotpot", BasePriceVND: 100000, AvailabilityStatus: "OUT_OF_STOCK", IsAvailable: false, HasVariants: true, PriceFromVND: &price}}}
	out, err := NewListMenuItems(repo, uuid.Nil).Handle(catalogTenantCtx(), ListMenuItemsRequest{CategoryID: &catID})
	require.NoError(t, err)
	require.Equal(t, catID, *repo.gotCatID)
	require.Len(t, out, 1)
	require.True(t, out[0].HasVariants)
	require.Equal(t, price, *out[0].PriceFromVND)
	require.Equal(t, "OUT_OF_STOCK", out[0].AvailabilityStatus)
}

func TestGetMenuItemDetailAndNotFound(t *testing.T) {
	max := 2
	itemID := uuid.New()
	groupID := uuid.New()
	repo := &fakeReadRepo{item: &domain.MenuItemDetail{
		ID:                 itemID,
		CategoryID:         uuid.New(),
		Name:               "Noodles",
		Slug:               "noodles",
		Images:             []string{"a.jpg"},
		BasePriceVND:       90000,
		AvailabilityStatus: "AVAILABLE",
		IsAvailable:        true,
		Variants:           []domain.VariantRead{{ID: uuid.New(), Name: "Large", PriceVND: 120000, IsAvailable: true}},
		OptionGroups:       []domain.OptionGroupRead{{ID: groupID, Name: "Spice", SelectionType: "SINGLE", IsRequired: true, MinSelections: 1, MaxSelections: &max, Options: []domain.OptionRead{{ID: uuid.New(), Name: "Extra spicy", PriceDeltaVND: 0}}}},
	}}
	out, err := NewGetMenuItem(repo, uuid.Nil).Handle(catalogTenantCtx(), GetMenuItemRequest{ItemID: itemID})
	require.NoError(t, err)
	require.Len(t, out.Variants, 1)
	require.Len(t, out.OptionGroups, 1)
	require.True(t, out.OptionGroups[0].IsRequired)
	require.Equal(t, max, *out.OptionGroups[0].MaxSelections)
	require.Len(t, out.OptionGroups[0].Options, 1)

	repo = &fakeReadRepo{err: apperr.New(apperr.CodeNotFound, "menu item not found")}
	_, err = NewGetMenuItem(repo, uuid.Nil).Handle(catalogTenantCtx(), GetMenuItemRequest{ItemID: itemID})
	require.True(t, apperr.Is(err, apperr.CodeNotFound))
}

func TestListAdminMenuItemsIncludesAdminFieldsAndHiddenRows(t *testing.T) {
	catID := uuid.New()
	price := int64(120000)
	repo := &fakeReadRepo{adminItems: []domain.AdminMenuItemSummary{{
		ID: uuid.New(), CategoryID: catID, Name: "Draft hotpot", Slug: "draft-hotpot",
		BasePriceVND: 100000, AvailabilityStatus: "HIDDEN", IsAvailable: false,
		HasVariants: true, PriceFromVND: &price, Status: "DRAFT", IsFeatured: true,
		Station: "HOTPOT", DisplayOrder: 7, Version: 3,
	}}}
	out, err := NewListAdminMenuItems(repo, uuid.Nil).Handle(catalogTenantCtx(), ListMenuItemsRequest{CategoryID: &catID})
	require.NoError(t, err)
	require.Equal(t, catID, *repo.gotCatID)
	require.Len(t, out, 1)
	require.Equal(t, "DRAFT", out[0].Status)
	require.Equal(t, "HIDDEN", out[0].AvailabilityStatus)
	require.True(t, out[0].IsFeatured)
	require.Equal(t, "HOTPOT", out[0].Station)
	require.Equal(t, 7, out[0].DisplayOrder)
	require.Equal(t, 3, out[0].Version)
}

func TestGetAdminMenuItemIncludesEditableFields(t *testing.T) {
	max := 2
	itemID := uuid.New()
	repo := &fakeReadRepo{adminItem: &domain.AdminMenuItemDetail{
		ID: itemID, CategoryID: uuid.New(), Name: "Archived noodles", Slug: "archived-noodles",
		Description: "full", ShortDescription: "short", ImageURL: "img", Images: []string{"a.jpg"},
		BasePriceVND: 90000, AvailabilityStatus: "OUT_OF_STOCK", IsAvailable: false,
		Status: "ARCHIVED", IsFeatured: true, IsSpicy: true, Station: "NOODLE",
		DisplayOrder: 11, Version: 5,
		Variants:     []domain.VariantRead{{ID: uuid.New(), Name: "Large", PriceVND: 120000}},
		OptionGroups: []domain.OptionGroupRead{{ID: uuid.New(), Name: "Spice", SelectionType: "SINGLE", MaxSelections: &max}},
	}}
	out, err := NewGetAdminMenuItem(repo, uuid.Nil).Handle(catalogTenantCtx(), GetMenuItemRequest{ItemID: itemID})
	require.NoError(t, err)
	require.Equal(t, itemID, out.ID)
	require.Equal(t, "ARCHIVED", out.Status)
	require.True(t, out.IsFeatured)
	require.Equal(t, "NOODLE", out.Station)
	require.Equal(t, 11, out.DisplayOrder)
	require.Equal(t, 5, out.Version)
	require.Len(t, out.Variants, 1)
	require.Len(t, out.OptionGroups, 1)
}
