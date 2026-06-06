package httpx

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"restaurant-management/internal/shared/apperr"
)

func TestRespondIncludesHTTPCode(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)

	Respond(context, http.StatusCreated, gin.H{"status": "ok"}, nil)

	var body Envelope
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	require.Equal(t, http.StatusCreated, body.Code)
	require.Equal(t, http.StatusCreated, recorder.Code)
}

func TestRespondErrorIncludesHTTPCode(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)

	RespondError(context, apperr.New(apperr.CodeForbidden, "forbidden"))

	var body Envelope
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	require.Equal(t, http.StatusForbidden, body.Code)
	require.Equal(t, http.StatusForbidden, recorder.Code)
	require.Equal(t, string(apperr.CodeForbidden), body.Error.Code)
}
