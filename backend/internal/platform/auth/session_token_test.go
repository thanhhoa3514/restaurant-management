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

type fakeSessionValidator struct {
	session SessionAuth
	err     error
}

func (v fakeSessionValidator) ValidateSessionToken(context.Context, string) (SessionAuth, error) {
	if v.err != nil {
		return SessionAuth{}, v.err
	}
	return v.session, nil
}

func runSessionMiddleware(v SessionValidator, token string, next gin.HandlerFunc) *httptest.ResponseRecorder {
	r := gin.New()
	r.GET("/x", QRSessionToken(v), next)
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	if token != "" {
		req.Header.Set("X-Session-Token", token)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestQRSessionTokenValidInjectsGuestSession(t *testing.T) {
	rid := uuid.New()
	sid := uuid.New()
	tableID := uuid.New()
	v := fakeSessionValidator{session: SessionAuth{RestaurantID: rid, SessionID: sid, TableID: tableID}}

	w := runSessionMiddleware(v, "session-token", func(c *gin.Context) {
		gotGuest, ok := guest.SessionFromContext(c.Request.Context())
		require.True(t, ok)
		require.Equal(t, rid, gotGuest.RestaurantID)
		require.Equal(t, sid, gotGuest.SessionID)
		require.Equal(t, tableID, gotGuest.TableID)
		c.Status(http.StatusOK)
	})

	require.Equal(t, http.StatusOK, w.Code)
}

func TestQRSessionTokenUnauthorized(t *testing.T) {
	t.Run("missing", func(t *testing.T) {
		w := runSessionMiddleware(fakeSessionValidator{}, "", func(c *gin.Context) { c.Status(http.StatusOK) })
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})
	t.Run("unknown or closed", func(t *testing.T) {
		w := runSessionMiddleware(fakeSessionValidator{err: apperr.New(apperr.CodeUnauthorized, "invalid")}, "bad", func(c *gin.Context) { c.Status(http.StatusOK) })
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})
}
