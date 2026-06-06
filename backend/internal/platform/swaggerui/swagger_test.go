package swaggerui

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRegisterServesSpecAndUI(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	Register(router)

	spec := httptest.NewRecorder()
	router.ServeHTTP(spec, httptest.NewRequest(http.MethodGet, SpecPath, nil))
	require.Equal(t, http.StatusOK, spec.Code)
	require.Contains(t, spec.Header().Get("Content-Type"), "application/yaml")
	require.Contains(t, spec.Body.String(), "openapi: 3.0.3")
	require.Contains(t, spec.Body.String(), "AuthenticateRequest")
	require.Contains(t, spec.Body.String(), "requestBody:")

	ui := httptest.NewRecorder()
	router.ServeHTTP(ui, httptest.NewRequest(http.MethodGet, UIPath, nil))
	require.Equal(t, http.StatusOK, ui.Code)
	require.Contains(t, ui.Body.String(), "swagger-initializer.js")

	initializer := httptest.NewRecorder()
	router.ServeHTTP(
		initializer,
		httptest.NewRequest(http.MethodGet, "/swagger/swagger-initializer.js", nil),
	)
	require.Equal(t, http.StatusOK, initializer.Code)
	require.Contains(t, initializer.Body.String(), SpecPath)

	redirect := httptest.NewRecorder()
	router.ServeHTTP(redirect, httptest.NewRequest(http.MethodGet, "/swagger", nil))
	require.Equal(t, http.StatusTemporaryRedirect, redirect.Code)
	require.Equal(t, UIPath, redirect.Header().Get("Location"))
}
