package ratelimit

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestMiddleware_IPKeyLimitsOnlyTheCurrentClient(t *testing.T) {
	gin.SetMode(gin.TestMode)
	limiter := NewSlidingWindow(2, time.Minute)
	defer limiter.Stop()

	router := gin.New()
	router.POST("/join", limiter.Middleware(IPKey), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	requestFrom := func(ip string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, "/join", nil)
		request.RemoteAddr = ip + ":1234"
		router.ServeHTTP(recorder, request)
		return recorder
	}

	require.Equal(t, http.StatusNoContent, requestFrom("192.0.2.10").Code)
	require.Equal(t, http.StatusNoContent, requestFrom("192.0.2.10").Code)

	limited := requestFrom("192.0.2.10")
	require.Equal(t, http.StatusTooManyRequests, limited.Code)
	require.Contains(t, limited.Body.String(), `"code":"rate_limited"`)

	require.Equal(t, http.StatusNoContent, requestFrom("192.0.2.11").Code)
}
