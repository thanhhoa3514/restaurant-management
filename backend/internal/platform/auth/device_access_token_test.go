package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"restaurant-management/internal/platform/guest"
	"restaurant-management/internal/shared/apperr"
)

type fakeDeviceAccessValidator struct {
	session DeviceAccessAuth
	err     error
}

func (v fakeDeviceAccessValidator) ValidateAccessToken(context.Context, string) (DeviceAccessAuth, error) {
	if v.err != nil {
		return DeviceAccessAuth{}, v.err
	}
	return v.session, nil
}

func runDeviceAccessMiddleware(v DeviceAccessValidator, token string, next gin.HandlerFunc) *httptest.ResponseRecorder {
	r := gin.New()
	r.GET("/x", DeviceAccessToken(v), next)
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	if token != "" {
		req.Header.Set("X-Device-Access-Token", token)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestDeviceAccessTokenValidInjectsGuestSession(t *testing.T) {
	rid := uuid.New()
	sid := uuid.New()
	tableID := uuid.New()
	v := fakeDeviceAccessValidator{session: DeviceAccessAuth{RestaurantID: rid, SessionID: sid, TableID: tableID}}

	w := runDeviceAccessMiddleware(v, "device-access-token", func(c *gin.Context) {
		gotGuest, ok := guest.SessionFromContext(c.Request.Context())
		require.True(t, ok)
		require.Equal(t, rid, gotGuest.RestaurantID)
		require.Equal(t, sid, gotGuest.SessionID)
		require.Equal(t, tableID, gotGuest.TableID)
		c.Status(http.StatusOK)
	})

	require.Equal(t, http.StatusOK, w.Code)
}

func TestDeviceAccessTokenUnauthorized(t *testing.T) {
	t.Run("missing", func(t *testing.T) {
		w := runDeviceAccessMiddleware(fakeDeviceAccessValidator{}, "", func(c *gin.Context) { c.Status(http.StatusOK) })
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})
	t.Run("unknown or closed", func(t *testing.T) {
		w := runDeviceAccessMiddleware(fakeDeviceAccessValidator{err: apperr.New(apperr.CodeUnauthorized, "invalid")}, "bad", func(c *gin.Context) { c.Status(http.StatusOK) })
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})
}
