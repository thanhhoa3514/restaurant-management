package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func init() { gin.SetMode(gin.TestMode) }

func TestAuthenticateMalformedJSONReturns400(t *testing.T) {
	r := gin.New()
	h := NewHandler(nil, nil)
	r.POST("/identity/authenticate", h.authenticate)

	req := httptest.NewRequest(http.MethodPost, "/identity/authenticate", strings.NewReader(`{"restaurant_code":`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusBadRequest, w.Code)
	require.Contains(t, w.Body.String(), `"code":"invalid"`)
}
