package application

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"restaurant-management/internal/modules/catalog/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type fakeCatalogTx struct{}

func (fakeCatalogTx) Run(ctx context.Context, fn func(context.Context) error) error { return fn(ctx) }

type fakeMenuRepo struct {
	categoryOK bool
	item       *domain.MenuItemForUpdate

	created *domain.MenuItemWrite
	updated *domain.MenuItemWrite
	toggled *domain.MenuItemToggle
	deleted bool
	audits  []domain.AuditLogWrite

	categoryChecked uuid.UUID
}

func (r *fakeMenuRepo) Save(context.Context, *domain.MenuItem) error { return nil }
func (r *fakeMenuRepo) Get(context.Context, uuid.UUID, uuid.UUID) (*domain.MenuItem, error) {
	return nil, nil
}
func (r *fakeMenuRepo) CategoryExists(_ context.Context, _ uuid.UUID, categoryID uuid.UUID) (bool, error) {
	r.categoryChecked = categoryID
	return r.categoryOK, nil
}
func (r *fakeMenuRepo) GetItemForUpdate(context.Context, uuid.UUID, uuid.UUID) (*domain.MenuItemForUpdate, error) {
	if r.item == nil {
		return nil, apperr.New(apperr.CodeNotFound, "menu item not found")
	}
	cp := *r.item
	return &cp, nil
}
func (r *fakeMenuRepo) CreateItem(_ context.Context, restaurantID uuid.UUID, item domain.MenuItemWrite) (domain.MenuItemForUpdate, error) {
	r.created = &item
	r.item = &domain.MenuItemForUpdate{
		ID: item.ID, RestaurantID: restaurantID, CategoryID: item.CategoryID, Code: item.Code, Name: item.Name,
		Slug: item.Slug, Description: item.Description, ShortDescription: item.ShortDescription,
		BasePriceVND: item.BasePriceVND, ImageURL: item.ImageURL, IsAvailable: item.IsAvailable,
		AvailabilityStatus: item.AvailabilityStatus, Status: item.Status, IsFeatured: item.IsFeatured,
		IsSpicy: item.IsSpicy, Station: item.Station, DisplayOrder: item.DisplayOrder, Version: 1,
	}
	return *r.item, nil
}
func (r *fakeMenuRepo) UpdateItem(_ context.Context, _ uuid.UUID, item domain.MenuItemWrite) (domain.MenuItemForUpdate, error) {
	r.updated = &item
	if r.item == nil || r.item.Version != item.Version {
		return domain.MenuItemForUpdate{}, apperr.New(apperr.CodeConflict, "menu item was modified, reload")
	}
	r.item.CategoryID = item.CategoryID
	r.item.Name = item.Name
	r.item.Slug = item.Slug
	r.item.Description = item.Description
	r.item.ShortDescription = item.ShortDescription
	r.item.BasePriceVND = item.BasePriceVND
	r.item.ImageURL = item.ImageURL
	r.item.IsAvailable = item.IsAvailable
	r.item.AvailabilityStatus = item.AvailabilityStatus
	r.item.Status = item.Status
	r.item.IsFeatured = item.IsFeatured
	r.item.IsSpicy = item.IsSpicy
	r.item.Station = item.Station
	r.item.DisplayOrder = item.DisplayOrder
	r.item.Version++
	return *r.item, nil
}
func (r *fakeMenuRepo) SoftDeleteItem(_ context.Context, _ uuid.UUID, _ uuid.UUID, version int, _ uuid.UUID) (domain.MenuItemForUpdate, error) {
	if r.item == nil || r.item.Version != version {
		return domain.MenuItemForUpdate{}, apperr.New(apperr.CodeConflict, "menu item was modified, reload")
	}
	r.deleted = true
	r.item.Version++
	return *r.item, nil
}
func (r *fakeMenuRepo) ToggleAvailability(_ context.Context, _ uuid.UUID, item domain.MenuItemToggle) (domain.MenuItemForUpdate, error) {
	r.toggled = &item
	if r.item == nil || r.item.Version != item.Version {
		return domain.MenuItemForUpdate{}, apperr.New(apperr.CodeConflict, "menu item was modified, reload")
	}
	r.item.IsAvailable = item.IsAvailable
	if item.AvailabilityStatus != nil {
		r.item.AvailabilityStatus = *item.AvailabilityStatus
	}
	r.item.Version++
	return *r.item, nil
}
func (r *fakeMenuRepo) WriteAuditLog(_ context.Context, audit domain.AuditLogWrite) error {
	r.audits = append(r.audits, audit)
	return nil
}

type fakeCatalogOutbox struct {
	writes []outbox.WriteEvent
}

func (f *fakeCatalogOutbox) Write(_ context.Context, event any) error {
	if e, ok := event.(outbox.WriteEvent); ok {
		f.writes = append(f.writes, e)
	}
	return nil
}

func catalogCommandCtx(rid uuid.UUID) context.Context {
	return context.Background()
}

func catalogMeta() CommandMetadata {
	return CommandMetadata{ActorID: uuid.New(), IPAddress: "127.0.0.1", UserAgent: "test-agent", TraceID: "trace-1"}
}

func existingMenuItem(rid, catID uuid.UUID) *domain.MenuItemForUpdate {
	return &domain.MenuItemForUpdate{
		ID: uuid.New(), RestaurantID: rid, CategoryID: catID, Code: "MI-OLD", Name: "Old Pho",
		Slug: "old-pho-abcd1234", Description: "old", ShortDescription: "old short",
		BasePriceVND: 100, ImageURL: "old.jpg", IsAvailable: true, AvailabilityStatus: "AVAILABLE",
		Status: "PUBLISHED", IsFeatured: false, IsSpicy: false, Station: "GENERAL",
		DisplayOrder: 1, Version: 2,
	}
}

func TestCreateMenuItemValidatesCategoryGeneratesSlugCodeAndWritesAuditOutbox(t *testing.T) {
	rid := uuid.New()
	catID := uuid.New()
	repo := &fakeMenuRepo{categoryOK: true}
	ob := &fakeCatalogOutbox{}

	out, err := NewCreateMenuItem(fakeCatalogTx{}, repo, ob, rid).Handle(catalogCommandCtx(rid), CreateMenuItemRequest{
		CategoryID: catID, Name: "Pho Bo", BasePriceVND: 45000, IsAvailable: true,
		AvailabilityStatus: "available", Status: "published", Station: "general", CommandMetadata: catalogMeta(),
	})

	require.NoError(t, err)
	require.NotEqual(t, uuid.Nil, out.ID)
	require.Equal(t, "PUBLISHED", out.Status)
	require.Equal(t, 1, out.Version)
	require.Equal(t, catID, repo.categoryChecked)
	require.NotNil(t, repo.created)
	require.True(t, strings.HasPrefix(repo.created.Slug, "pho-bo-"))
	require.True(t, strings.HasPrefix(repo.created.Code, "MI-"))
	require.Len(t, repo.created.Code, 11)
	require.Len(t, repo.audits, 1)
	require.Equal(t, "catalog.item_created", repo.audits[0].Action)
	require.Len(t, ob.writes, 1)
	require.Equal(t, "catalog.item_created", ob.writes[0].EventType)
}

func TestCreateMenuItemRejectsCategoryOutsideTenant(t *testing.T) {
	rid := uuid.New()
	repo := &fakeMenuRepo{categoryOK: false}

	_, err := NewCreateMenuItem(fakeCatalogTx{}, repo, nil, rid).Handle(catalogCommandCtx(rid), CreateMenuItemRequest{
		CategoryID: uuid.New(), Name: "Pho Bo", BasePriceVND: 45000, IsAvailable: true,
		AvailabilityStatus: "AVAILABLE", Status: "PUBLISHED", CommandMetadata: catalogMeta(),
	})

	require.True(t, apperr.Is(err, apperr.CodeNotFound))
	require.Nil(t, repo.created)
	require.Empty(t, repo.audits)
}

func TestUpdateMenuItemGuardsVersionAndWritesAuditOutbox(t *testing.T) {
	rid := uuid.New()
	catID := uuid.New()
	item := existingMenuItem(rid, catID)
	repo := &fakeMenuRepo{categoryOK: true, item: item}
	ob := &fakeCatalogOutbox{}

	out, err := NewUpdateMenuItem(fakeCatalogTx{}, repo, ob, rid).Handle(catalogCommandCtx(rid), UpdateMenuItemRequest{
		ID: item.ID, CategoryID: catID, Name: "New Pho", BasePriceVND: 120,
		IsAvailable: true, AvailabilityStatus: "AVAILABLE", Status: "PUBLISHED",
		IsFeatured: true, Station: "HOTPOT", DisplayOrder: 3, Version: 2, CommandMetadata: catalogMeta(),
	})

	require.NoError(t, err)
	require.Equal(t, 3, out.Version)
	require.NotNil(t, repo.updated)
	require.Equal(t, "new-pho-"+shortID(item.ID), repo.updated.Slug)
	require.Len(t, repo.audits, 1)
	require.Equal(t, "catalog.item_updated", repo.audits[0].Action)
	require.Len(t, ob.writes, 1)
	require.Equal(t, "catalog.item_updated", ob.writes[0].EventType)

	_, err = NewUpdateMenuItem(fakeCatalogTx{}, repo, nil, rid).Handle(catalogCommandCtx(rid), UpdateMenuItemRequest{
		ID: item.ID, CategoryID: catID, Name: "Stale", BasePriceVND: 120,
		IsAvailable: true, AvailabilityStatus: "AVAILABLE", Status: "PUBLISHED", Version: 2, CommandMetadata: catalogMeta(),
	})
	require.True(t, apperr.Is(err, apperr.CodeConflict))
}

func TestDeleteMenuItemSoftDeletesWithVersionAndAuditOutbox(t *testing.T) {
	rid := uuid.New()
	catID := uuid.New()
	item := existingMenuItem(rid, catID)
	repo := &fakeMenuRepo{item: item}
	ob := &fakeCatalogOutbox{}

	out, err := NewDeleteMenuItem(fakeCatalogTx{}, repo, ob, rid).Handle(catalogCommandCtx(rid), DeleteMenuItemRequest{ID: item.ID, Version: 2, CommandMetadata: catalogMeta()})

	require.NoError(t, err)
	require.True(t, repo.deleted)
	require.Equal(t, 3, out.Version)
	require.Len(t, repo.audits, 1)
	require.Equal(t, "catalog.item_deleted", repo.audits[0].Action)
	require.Len(t, ob.writes, 1)
	require.Equal(t, "catalog.item_deleted", ob.writes[0].EventType)

	_, err = NewDeleteMenuItem(fakeCatalogTx{}, repo, nil, rid).Handle(catalogCommandCtx(rid), DeleteMenuItemRequest{ID: item.ID, Version: 2, CommandMetadata: catalogMeta()})
	require.True(t, apperr.Is(err, apperr.CodeConflict))
}

func TestToggleAvailabilityRequiresCurrentVersionAndKeepsPublishStatus(t *testing.T) {
	rid := uuid.New()
	catID := uuid.New()
	item := existingMenuItem(rid, catID)
	repo := &fakeMenuRepo{item: item}
	ob := &fakeCatalogOutbox{}
	status := "OUT_OF_STOCK"

	out, err := NewToggleAvailability(fakeCatalogTx{}, repo, ob, rid).Handle(catalogCommandCtx(rid), ToggleAvailabilityRequest{
		ID: item.ID, IsAvailable: false, AvailabilityStatus: &status, Version: 2, CommandMetadata: catalogMeta(),
	})

	require.NoError(t, err)
	require.Equal(t, 3, out.Version)
	require.Equal(t, "PUBLISHED", out.Status)
	require.NotNil(t, repo.toggled.AvailabilityStatus)
	require.Equal(t, "OUT_OF_STOCK", *repo.toggled.AvailabilityStatus)
	require.False(t, repo.item.IsAvailable)
	require.Equal(t, "OUT_OF_STOCK", repo.item.AvailabilityStatus)
	require.Len(t, repo.audits, 1)
	require.Equal(t, "catalog.item_availability_toggled", repo.audits[0].Action)
	require.Len(t, ob.writes, 1)
	require.Equal(t, "catalog.item_availability_toggled", ob.writes[0].EventType)

	_, err = NewToggleAvailability(fakeCatalogTx{}, repo, nil, rid).Handle(catalogCommandCtx(rid), ToggleAvailabilityRequest{
		ID: item.ID, IsAvailable: true, Version: 2, CommandMetadata: catalogMeta(),
	})
	require.True(t, apperr.Is(err, apperr.CodeConflict))
}
