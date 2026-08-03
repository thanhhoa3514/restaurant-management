package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"restaurant-management/internal/modules/catalog/application"
	"restaurant-management/internal/modules/catalog/domain"
	"restaurant-management/internal/platform/auth"
)

type fakeMenuReadRepo struct{}

func (fakeMenuReadRepo) ListCategories(context.Context, uuid.UUID) ([]domain.CategoryRead, error) {
	return []domain.CategoryRead{}, nil
}
func (fakeMenuReadRepo) ListItems(context.Context, uuid.UUID, *uuid.UUID) ([]domain.MenuItemSummary, error) {
	return []domain.MenuItemSummary{}, nil
}
func (fakeMenuReadRepo) GetItem(context.Context, uuid.UUID, uuid.UUID) (*domain.MenuItemDetail, error) {
	return nil, nil
}
func (fakeMenuReadRepo) ListItemsAdmin(context.Context, uuid.UUID, *uuid.UUID) ([]domain.AdminMenuItemSummary, error) {
	return []domain.AdminMenuItemSummary{}, nil
}
func (fakeMenuReadRepo) GetItemAdmin(context.Context, uuid.UUID, uuid.UUID) (*domain.AdminMenuItemDetail, error) {
	return nil, nil
}

type fakeDeviceAccessValidator struct {
	err error
}

func (v fakeDeviceAccessValidator) ValidateAccessToken(context.Context, string) (auth.DeviceAccessAuth, error) {
	if v.err != nil {
		return auth.DeviceAccessAuth{}, v.err
	}
	return auth.DeviceAccessAuth{RestaurantID: uuid.New(), SessionID: uuid.New(), TableID: uuid.New()}, nil
}

func guestRouter(v auth.DeviceAccessValidator) *gin.Engine {
	gin.SetMode(gin.TestMode)
	repo := fakeMenuReadRepo{}
	h := NewHandler(nil, nil, nil, nil, application.NewListCategories(repo, uuid.Nil), application.NewListMenuItems(repo, uuid.Nil), application.NewGetMenuItem(repo, uuid.Nil), application.NewListAdminMenuItems(repo, uuid.Nil), application.NewGetAdminMenuItem(repo, uuid.Nil), nil)
	r := gin.New()
	guestGroup := r.Group("/api/v1/customer", auth.DeviceAccessToken(v))
	h.RegisterGuestRoutes(guestGroup)
	return r
}

func TestGuestMenuRoutesRequireDeviceAccessToken(t *testing.T) {
	r := guestRouter(fakeDeviceAccessValidator{})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/customer/menu/categories", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestGuestMenuItemsBadCategoryIDReturns400(t *testing.T) {
	r := guestRouter(fakeDeviceAccessValidator{})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/customer/menu/items?category_id=bad", nil)
	req.Header.Set("X-Device-Access-Token", "valid")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusBadRequest, w.Code)
}

func TestGuestMenuItemBadPathIDReturns400(t *testing.T) {
	r := guestRouter(fakeDeviceAccessValidator{})
	req := httptest.NewRequest(http.MethodGet, "/api/v1/customer/menu/items/bad", nil)
	req.Header.Set("X-Device-Access-Token", "valid")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusBadRequest, w.Code)
}
