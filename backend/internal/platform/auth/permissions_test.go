package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

type fakePermissionResolver struct {
	codes []string
	err   error
}

func (r fakePermissionResolver) ResolvePermissionCodes(context.Context, uuid.UUID, uuid.UUID) ([]string, error) {
	return r.codes, r.err
}

func TestRequirePermission(t *testing.T) {
	restaurantID := uuid.New()
	userID := uuid.New()
	run := func(codes []string) int {
		r := gin.New()
		r.GET(
			"/x",
			func(c *gin.Context) {
				c.Set(CtxUserID, userID.String())
				c.Next()
			},
			RequirePermission(fakePermissionResolver{codes: codes}, PermissionBillingProcess, restaurantID),
			ok,
		)
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code
	}

	require.Equal(t, http.StatusOK, run([]string{PermissionBillingProcess}))
	require.Equal(t, http.StatusForbidden, run([]string{PermissionOrderingStaff}))
	require.Equal(t, http.StatusForbidden, run(nil))
}
