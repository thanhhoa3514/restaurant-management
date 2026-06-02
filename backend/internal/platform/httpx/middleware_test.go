package httpx

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"restaurant-management/internal/platform/logger"
)

func init() { gin.SetMode(gin.TestMode) }

func newRouter(base *slog.Logger, register func(*gin.Engine)) *gin.Engine {
	r := gin.New()
	r.Use(RequestID(), Logger(base), Recover())
	register(r)
	return r
}

func do(r *gin.Engine, method, path string, header http.Header) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	if header != nil {
		req.Header = header
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func decodeLines(t *testing.T, buf *bytes.Buffer) []map[string]any {
	t.Helper()
	var out []map[string]any
	for _, line := range bytes.Split(bytes.TrimSpace(buf.Bytes()), []byte("\n")) {
		if len(line) == 0 {
			continue
		}
		var m map[string]any
		require.NoError(t, json.Unmarshal(line, &m))
		out = append(out, m)
	}
	return out
}

func TestRequestIDGeneratesWhenMissing(t *testing.T) {
	r := newRouter(slog.New(slog.DiscardHandler), func(r *gin.Engine) {
		r.GET("/x", func(c *gin.Context) { c.Status(http.StatusOK) })
	})
	w := do(r, http.MethodGet, "/x", nil)
	require.NotEmpty(t, w.Header().Get("X-Request-ID"))
}

func TestRequestIDPreservesIncoming(t *testing.T) {
	r := newRouter(slog.New(slog.DiscardHandler), func(r *gin.Engine) {
		r.GET("/x", func(c *gin.Context) { c.Status(http.StatusOK) })
	})
	h := http.Header{"X-Request-Id": []string{"abc-123"}}
	w := do(r, http.MethodGet, "/x", h)
	require.Equal(t, "abc-123", w.Header().Get("X-Request-ID"))
}

func TestLoggerEmitsAccessLogWithRequestID(t *testing.T) {
	var buf bytes.Buffer
	base := slog.New(slog.NewJSONHandler(&buf, nil))
	r := newRouter(base, func(r *gin.Engine) {
		r.GET("/items", func(c *gin.Context) { c.Status(http.StatusOK) })
	})

	h := http.Header{"X-Request-Id": []string{"req-42"}}
	do(r, http.MethodGet, "/items", h)

	lines := decodeLines(t, &buf)
	require.Len(t, lines, 1)
	entry := lines[0]
	require.Equal(t, "request completed", entry["msg"])
	require.Equal(t, "INFO", entry["level"])
	require.Equal(t, "req-42", entry["request_id"])
	require.Equal(t, "/items", entry["path"])
	require.Equal(t, "GET", entry["method"])
	require.EqualValues(t, http.StatusOK, entry["status"])
}

func TestLoggerLevelTracksStatus(t *testing.T) {
	cases := []struct {
		status int
		level  string
		msg    string
	}{
		{http.StatusOK, "INFO", "request completed"},
		{http.StatusBadRequest, "WARN", "request rejected"},
		{http.StatusInternalServerError, "ERROR", "request failed"},
	}
	for _, tc := range cases {
		var buf bytes.Buffer
		base := slog.New(slog.NewJSONHandler(&buf, nil))
		r := newRouter(base, func(r *gin.Engine) {
			r.GET("/x", func(c *gin.Context) { c.Status(tc.status) })
		})
		do(r, http.MethodGet, "/x", nil)

		lines := decodeLines(t, &buf)
		require.Len(t, lines, 1)
		require.Equal(t, tc.level, lines[0]["level"], "status %d", tc.status)
		require.Equal(t, tc.msg, lines[0]["msg"], "status %d", tc.status)
	}
}

func TestLoggerInjectsContextLogger(t *testing.T) {
	base := slog.New(slog.DiscardHandler)
	var gotSame bool
	r := newRouter(base, func(r *gin.Engine) {
		r.GET("/x", func(c *gin.Context) {
			l := logger.FromContext(c.Request.Context())
			gotSame = l != nil && l != slog.Default()
			c.Status(http.StatusOK)
		})
	})
	do(r, http.MethodGet, "/x", nil)
	require.True(t, gotSame, "handler should see request-scoped logger from context")
}

func TestRecoverLogsPanicAndReturns500(t *testing.T) {
	var buf bytes.Buffer
	base := slog.New(slog.NewJSONHandler(&buf, nil))
	r := newRouter(base, func(r *gin.Engine) {
		r.GET("/boom", func(c *gin.Context) { panic("kaboom") })
	})

	w := do(r, http.MethodGet, "/boom", nil)
	require.Equal(t, http.StatusInternalServerError, w.Code)

	var found bool
	for _, entry := range decodeLines(t, &buf) {
		if entry["msg"] == "panic recovered" {
			found = true
			require.Equal(t, "kaboom", entry["panic"])
			require.Contains(t, entry["stack"], "middleware.go")
		}
	}
	require.True(t, found, "expected a 'panic recovered' log entry")
}
