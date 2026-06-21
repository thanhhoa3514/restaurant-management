package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"restaurant-management/internal/modules/ordering/application"
	"restaurant-management/internal/modules/ordering/domain"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/shared/apperr"
)

type guestRouteRepo struct{}

func (guestRouteRepo) LockSessionForOrder(context.Context, uuid.UUID, uuid.UUID) (*domain.SessionForOrder, error) {
	return nil, apperr.New(apperr.CodeConflict, "stop before insert")
}
func (guestRouteRepo) FindMenuItemForOrder(context.Context, uuid.UUID, uuid.UUID) (*domain.MenuItemForOrder, error) {
	return nil, nil
}
func (guestRouteRepo) FindVariantForOrder(context.Context, uuid.UUID, uuid.UUID, uuid.UUID) (*domain.VariantForOrder, error) {
	return nil, nil
}
func (guestRouteRepo) ListOptionGroupRules(context.Context, uuid.UUID, uuid.UUID) ([]domain.OptionGroupRule, error) {
	return nil, nil
}
func (guestRouteRepo) ListOptionsForOrder(context.Context, uuid.UUID, uuid.UUID, []uuid.UUID) ([]domain.OptionForOrder, error) {
	return nil, nil
}
func (guestRouteRepo) HasPriorOrders(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return false, nil
}
func (guestRouteRepo) CreateOrderGraph(context.Context, *domain.OrderCreate) error { return nil }
func (guestRouteRepo) SessionTotal(context.Context, uuid.UUID, uuid.UUID) (int64, error) {
	return 0, nil
}
func (guestRouteRepo) ViewSessionOrders(context.Context, uuid.UUID, uuid.UUID) (domain.OrderView, error) {
	return domain.OrderView{Orders: []domain.OrderRead{}}, nil
}

type guestRouteTx struct{}

func (guestRouteTx) Run(ctx context.Context, fn func(context.Context) error) error { return fn(ctx) }

type routeSessionValidator struct{}

func (routeSessionValidator) ValidateSessionToken(context.Context, string) (auth.SessionAuth, error) {
	return auth.SessionAuth{RestaurantID: uuid.New(), SessionID: uuid.New(), TableID: uuid.New()}, nil
}

func guestOrderRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	repo := guestRouteRepo{}
	h := NewHandler(application.NewGuestPlaceOrder(guestRouteTx{}, repo, nil), application.NewGuestViewOrders(repo), nil, nil, nil, nil, nil, nil, nil)
	r := gin.New()
	g := r.Group("/api/v1/guest", auth.QRSessionToken(routeSessionValidator{}))
	h.RegisterGuestRoutes(g)
	return r
}

func TestGuestOrderRoutesRequireSessionToken(t *testing.T) {
	r := guestOrderRouter()
	cases := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/v1/guest/orders"},
		{http.MethodPut, "/api/v1/guest/orders/" + uuid.NewString() + "/items"},
		{http.MethodDelete, "/api/v1/guest/orders/" + uuid.NewString()},
		{http.MethodPost, "/api/v1/guest/orders/" + uuid.NewString() + "/cancel-requests"},
	}
	for _, tc := range cases {
		req := httptest.NewRequest(tc.method, tc.path, nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	}
}

func TestGuestOrderPostBindError400(t *testing.T) {
	r := guestOrderRouter()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/guest/orders", strings.NewReader(`{"items":`))
	req.Header.Set("X-Session-Token", "valid")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusBadRequest, w.Code)
}
