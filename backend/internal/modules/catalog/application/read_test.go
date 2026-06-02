package application

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"restaurant-management/internal/modules/catalog/domain"
	"restaurant-management/internal/platform/tenant"
	"restaurant-management/internal/shared/apperr"
)

type fakeReadRepo struct {
	categories []domain.CategoryRead
	items      []domain.MenuItemSummary
	item       *domain.MenuItemDetail
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

func catalogTenantCtx() context.Context {
	return tenant.WithRestaurantID(context.Background(), uuid.New())
}

func TestListCategoriesReturnsOrderedRowsAndEmpty(t *testing.T) {
	repo := &fakeReadRepo{categories: []domain.CategoryRead{{ID: uuid.New(), Name: "A", Slug: "a", DisplayOrder: 1}}}
	out, err := NewListCategories(repo).Handle(catalogTenantCtx())
	require.NoError(t, err)
	require.Len(t, out, 1)
	require.Equal(t, "A", out[0].Name)

	repo = &fakeReadRepo{}
	out, err = NewListCategories(repo).Handle(catalogTenantCtx())
	require.NoError(t, err)
	require.Empty(t, out)
}

func TestListMenuItemsCategoryAndVariantSummary(t *testing.T) {
	catID := uuid.New()
	price := int64(120000)
	repo := &fakeReadRepo{items: []domain.MenuItemSummary{{ID: uuid.New(), CategoryID: catID, Name: "Hotpot", Slug: "hotpot", BasePriceVND: 100000, AvailabilityStatus: "OUT_OF_STOCK", IsAvailable: false, HasVariants: true, PriceFromVND: &price}}}
	out, err := NewListMenuItems(repo).Handle(catalogTenantCtx(), ListMenuItemsRequest{CategoryID: &catID})
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
	out, err := NewGetMenuItem(repo).Handle(catalogTenantCtx(), GetMenuItemRequest{ItemID: itemID})
	require.NoError(t, err)
	require.Len(t, out.Variants, 1)
	require.Len(t, out.OptionGroups, 1)
	require.True(t, out.OptionGroups[0].IsRequired)
	require.Equal(t, max, *out.OptionGroups[0].MaxSelections)
	require.Len(t, out.OptionGroups[0].Options, 1)

	repo = &fakeReadRepo{err: apperr.New(apperr.CodeNotFound, "menu item not found")}
	_, err = NewGetMenuItem(repo).Handle(catalogTenantCtx(), GetMenuItemRequest{ItemID: itemID})
	require.True(t, apperr.Is(err, apperr.CodeNotFound))
}
