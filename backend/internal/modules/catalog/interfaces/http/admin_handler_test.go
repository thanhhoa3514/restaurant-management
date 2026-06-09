package http

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"restaurant-management/internal/modules/catalog/application"
	"restaurant-management/internal/platform/auth"
)

type fakePermissionResolver struct {
	permissions []string
}

func (r fakePermissionResolver) ResolvePermissionCodes(context.Context, uuid.UUID, uuid.UUID) ([]string, error) {
	return r.permissions, nil
}

func adminCatalogRouter(resolver auth.PermissionResolver, secret string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	repo := fakeMenuReadRepo{}
	h := NewHandler(nil, nil, nil, nil, application.NewListCategories(repo), application.NewListMenuItems(repo), application.NewGetMenuItem(repo), application.NewListAdminMenuItems(repo), application.NewGetAdminMenuItem(repo))
	r := gin.New()
	h.RegisterRoutes(r.Group("/api/v1"), secret, resolver)
	return r
}

func adminToken(t *testing.T, secret string, restaurantID, userID uuid.UUID) string {
	t.Helper()
	token, err := auth.Issue(secret, auth.Claims{UserID: userID.String(), RestaurantID: restaurantID.String(), Role: "MANAGER"}, time.Hour)
	require.NoError(t, err)
	return token
}

func TestAdminCatalogRoutesRequireCatalogManage(t *testing.T) {
	secret := "test-secret"
	rid := uuid.New()
	uid := uuid.New()

	r := adminCatalogRouter(fakePermissionResolver{}, secret)
	token := adminToken(t, secret, rid, uid)
	for _, tc := range []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/v1/catalog/categories"},
		{http.MethodGet, "/api/v1/catalog/items"},
		{http.MethodGet, "/api/v1/catalog/items/" + uuid.NewString()},
		{http.MethodPost, "/api/v1/catalog/create-menu-item"},
		{http.MethodPost, "/api/v1/catalog/update-menu-item"},
		{http.MethodPost, "/api/v1/catalog/delete-menu-item"},
		{http.MethodPost, "/api/v1/catalog/toggle-availability"},
	} {
		req := httptest.NewRequest(tc.method, tc.path, bytes.NewBufferString(`{}`))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		require.Equal(t, http.StatusForbidden, w.Code, "%s %s", tc.method, tc.path)
	}

	r = adminCatalogRouter(fakePermissionResolver{permissions: []string{auth.PermissionCatalogManage}}, secret)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/catalog/categories", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken(t, secret, rid, uid))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)
}

func TestAdminCatalogItemsRequireStaffJWT(t *testing.T) {
	r := adminCatalogRouter(fakePermissionResolver{permissions: []string{auth.PermissionCatalogManage}}, "test-secret")
	req := httptest.NewRequest(http.MethodGet, "/api/v1/catalog/items", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}
