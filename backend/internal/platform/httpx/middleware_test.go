package httpx

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
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

// readBody registers a POST handler that drains the body and reports 200 when
// the read succeeds or 413 when MaxBytesReader trips.
func readBodyRouter(limit int64) *gin.Engine {
	r := gin.New()
	r.Use(MaxBodyBytes(limit))
	r.POST("/x", func(c *gin.Context) {
		if _, err := io.ReadAll(c.Request.Body); err != nil {
			c.Status(http.StatusRequestEntityTooLarge)
			return
		}
		c.Status(http.StatusOK)
	})
	return r
}

func postBody(r *gin.Engine, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/x", strings.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestMaxBodyBytesAllowsUnderLimit(t *testing.T) {
	r := readBodyRouter(16)
	w := postBody(r, "small")
	require.Equal(t, http.StatusOK, w.Code)
}

func TestMaxBodyBytesRejectsOverLimit(t *testing.T) {
	r := readBodyRouter(8)
	w := postBody(r, strings.Repeat("x", 64))
	require.Equal(t, http.StatusRequestEntityTooLarge, w.Code)
}

func corsRouter(allowed []string) *gin.Engine {
	r := gin.New()
	r.Use(CORS(allowed))
	r.GET("/x", func(c *gin.Context) { c.Status(http.StatusOK) })
	return r
}

func TestCORSEmptyListWildcards(t *testing.T) {
	r := corsRouter(nil)
	h := http.Header{"Origin": []string{"https://anything.example"}}
	w := do(r, http.MethodGet, "/x", h)
	require.Equal(t, "*", w.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSEchoesAllowedOrigin(t *testing.T) {
	r := corsRouter([]string{"https://staff.example"})
	h := http.Header{"Origin": []string{"https://staff.example"}}
	w := do(r, http.MethodGet, "/x", h)
	require.Equal(t, "https://staff.example", w.Header().Get("Access-Control-Allow-Origin"))
	require.Equal(t, "Origin", w.Header().Get("Vary"))
}

func TestCORSRejectsUnknownOrigin(t *testing.T) {
	r := corsRouter([]string{"https://staff.example"})
	h := http.Header{"Origin": []string{"https://evil.example"}}
	w := do(r, http.MethodGet, "/x", h)
	require.Empty(t, w.Header().Get("Access-Control-Allow-Origin"))
}

func TestCORSPreflightShortCircuits(t *testing.T) {
	r := corsRouter([]string{"https://staff.example"})
	h := http.Header{"Origin": []string{"https://staff.example"}}
	w := do(r, http.MethodOptions, "/x", h)
	require.Equal(t, http.StatusNoContent, w.Code)
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
