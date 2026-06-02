package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"restaurant-management/internal/platform/tenant"
)

const testSecret = "test-secret"

func init() { gin.SetMode(gin.TestMode) }

func signHS256(t *testing.T, c Claims) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, c)
	s, err := tok.SignedString([]byte(testSecret))
	require.NoError(t, err)
	return s
}

func runJWT(secret, header string, next gin.HandlerFunc) *httptest.ResponseRecorder {
	r := gin.New()
	r.GET("/x", JWT(secret), next)
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	if header != "" {
		req.Header.Set("Authorization", header)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func ok(c *gin.Context) { c.Status(http.StatusOK) }

func TestJWTMissingToken(t *testing.T) {
	w := runJWT(testSecret, "", ok)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestJWTInvalidSignature(t *testing.T) {
	tok := signHS256(t, Claims{RestaurantID: uuid.NewString()})
	w := runJWT("other-secret", "Bearer "+tok, ok)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestJWTRejectsNonHMACAlg(t *testing.T) {
	// alg "none" must be refused by WithValidMethods([]string{"HS256"}).
	tok := jwt.NewWithClaims(jwt.SigningMethodNone, Claims{RestaurantID: uuid.NewString()})
	s, err := tok.SignedString(jwt.UnsafeAllowNoneSignatureType)
	require.NoError(t, err)
	w := runJWT(testSecret, "Bearer "+s, ok)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestJWTInvalidRestaurantClaim(t *testing.T) {
	tok := signHS256(t, Claims{UserID: "u1", Role: "MANAGER", RestaurantID: "not-a-uuid"})
	w := runJWT(testSecret, "Bearer "+tok, ok)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestJWTValidPopulatesContext(t *testing.T) {
	rid := uuid.New()
	tok := signHS256(t, Claims{
		UserID:           "user-1",
		Role:             "MANAGER",
		RestaurantID:     rid.String(),
		RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))},
	})

	var gotRole, gotUser string
	var gotTenant uuid.UUID
	var tenantOK bool
	w := runJWT(testSecret, "Bearer "+tok, func(c *gin.Context) {
		gotRole = c.GetString(CtxRole)
		gotUser = c.GetString(CtxUserID)
		gotTenant, tenantOK = tenant.RestaurantID(c.Request.Context())
		c.Status(http.StatusOK)
	})

	require.Equal(t, http.StatusOK, w.Code)
	require.Equal(t, "MANAGER", gotRole)
	require.Equal(t, "user-1", gotUser)
	require.True(t, tenantOK, "tenant must reach usecase via request context")
	require.Equal(t, rid, gotTenant)
}

func TestRBAC(t *testing.T) {
	run := func(role string, allowed ...string) int {
		r := gin.New()
		r.GET("/x", func(c *gin.Context) { c.Set(CtxRole, role); c.Next() }, RBAC(allowed...), ok)
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code
	}
	require.Equal(t, http.StatusOK, run("MANAGER", "MANAGER", "CASHIER"))
	require.Equal(t, http.StatusForbidden, run("SERVER", "MANAGER"))
	require.Equal(t, http.StatusForbidden, run("", "MANAGER"))
}

func TestIssueRoundTripsThroughJWT(t *testing.T) {
	rid := uuid.New()
	uid := uuid.New()
	tok, err := Issue(testSecret, Claims{UserID: uid.String(), RestaurantID: rid.String(), Role: "MANAGER"}, time.Hour)
	require.NoError(t, err)

	var gotRole, gotUser string
	var gotTenant uuid.UUID
	w := runJWT(testSecret, "Bearer "+tok, func(c *gin.Context) {
		gotRole = c.GetString(CtxRole)
		gotUser = c.GetString(CtxUserID)
		gotTenant, _ = tenant.RestaurantID(c.Request.Context())
		c.Status(http.StatusOK)
	})

	require.Equal(t, http.StatusOK, w.Code)
	require.Equal(t, "MANAGER", gotRole)
	require.Equal(t, uid.String(), gotUser)
	require.Equal(t, rid, gotTenant)
}

func TestIssueExpiredTokenRejected(t *testing.T) {
	tok, err := Issue(testSecret, Claims{UserID: uuid.NewString(), RestaurantID: uuid.NewString(), Role: "MANAGER"}, -time.Hour)
	require.NoError(t, err)
	w := runJWT(testSecret, "Bearer "+tok, ok)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}
