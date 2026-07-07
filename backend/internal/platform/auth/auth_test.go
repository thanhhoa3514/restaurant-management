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
	tok := signHS256(t, Claims{UserID: uuid.NewString()})
	w := runJWT("other-secret", "Bearer "+tok, ok)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestJWTRejectsNonHMACAlg(t *testing.T) {
	tok := jwt.NewWithClaims(jwt.SigningMethodNone, Claims{UserID: uuid.NewString()})
	s, err := tok.SignedString(jwt.UnsafeAllowNoneSignatureType)
	require.NoError(t, err)
	w := runJWT(testSecret, "Bearer "+s, ok)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestJWTValidPopulatesContext(t *testing.T) {
	tok := signHS256(t, Claims{
		UserID:           "user-1",
		Role:             "MANAGER",
		RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))},
	})

	var gotRole, gotUser string
	w := runJWT(testSecret, "Bearer "+tok, func(c *gin.Context) {
		gotRole = c.GetString(CtxRole)
		gotUser = c.GetString(CtxUserID)
		c.Status(http.StatusOK)
	})

	require.Equal(t, http.StatusOK, w.Code)
	require.Equal(t, "MANAGER", gotRole)
	require.Equal(t, "user-1", gotUser)
}

func TestIssueRoundTripsThroughJWT(t *testing.T) {
	uid := uuid.New()
	tok, err := Issue(testSecret, Claims{UserID: uid.String(), Role: "MANAGER"}, time.Hour)
	require.NoError(t, err)

	var gotRole, gotUser string
	w := runJWT(testSecret, "Bearer "+tok, func(c *gin.Context) {
		gotRole = c.GetString(CtxRole)
		gotUser = c.GetString(CtxUserID)
		c.Status(http.StatusOK)
	})

	require.Equal(t, http.StatusOK, w.Code)
	require.Equal(t, "MANAGER", gotRole)
	require.Equal(t, uid.String(), gotUser)
}

func TestIssueExpiredTokenRejected(t *testing.T) {
	tok, err := Issue(testSecret, Claims{UserID: uuid.NewString(), Role: "MANAGER"}, -time.Hour)
	require.NoError(t, err)
	w := runJWT(testSecret, "Bearer "+tok, ok)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}
