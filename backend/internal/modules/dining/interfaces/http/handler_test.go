package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"restaurant-management/internal/platform/auth"
)

func TestStaffVerifyDevice_MalformedBodyReturnsBadRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := &Handler{}
	actorID := uuid.New()
	deviceID := uuid.New()

	for _, body := range []string{"", `{"action":`} {
		recorder := httptest.NewRecorder()
		context, _ := gin.CreateTestContext(recorder)
		context.Request = httptest.NewRequest(http.MethodPost, "/devices/"+deviceID.String()+"/verify", strings.NewReader(body))
		context.Params = gin.Params{{Key: "deviceId", Value: deviceID.String()}}
		context.Set(auth.CtxUserID, actorID.String())

		handler.staffVerifyDevice(context)

		require.Equal(t, http.StatusBadRequest, recorder.Code)
		require.Contains(t, recorder.Body.String(), `"code":"invalid"`)
	}
}

func TestRegisterGuestRoutes_AppliesJoinMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	group := router.Group("/api/v1/customer")
	handler := &Handler{}
	handler.RegisterGuestRoutes(group, func(c *gin.Context) {
		c.Status(http.StatusTooManyRequests)
		c.Abort()
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/customer/sessions/join", strings.NewReader(`{}`))
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusTooManyRequests, recorder.Code)
}
