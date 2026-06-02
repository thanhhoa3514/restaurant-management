package httpx

import (
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"restaurant-management/internal/platform/logger"
)

const requestIDKey = "request_id"

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader("X-Request-ID")
		if id == "" {
			id = uuid.NewString()
		}
		c.Set(requestIDKey, id)
		c.Header("X-Request-ID", id)
		c.Next()
	}
}

// Logger attaches a request-scoped logger (tagged with request_id) to the
// request context and emits one access-log line per request once it completes.
func Logger(base *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		id, _ := c.Get(requestIDKey)

		reqLog := base.With(slog.Any("request_id", id))
		c.Request = c.Request.WithContext(logger.WithContext(c.Request.Context(), reqLog))

		c.Next()

		attrs := []any{
			slog.String("method", c.Request.Method),
			slog.String("path", c.FullPath()),
			slog.Int("status", c.Writer.Status()),
			slog.Duration("latency", time.Since(start)),
			slog.String("client_ip", c.ClientIP()),
		}
		switch status := c.Writer.Status(); {
		case status >= http.StatusInternalServerError:
			reqLog.Error("request failed", attrs...)
		case status >= http.StatusBadRequest:
			reqLog.Warn("request rejected", attrs...)
		default:
			reqLog.Info("request completed", attrs...)
		}
	}
}

func Recover() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered any) {
		logger.FromContext(c.Request.Context()).Error("panic recovered",
			slog.Any("panic", recovered),
			slog.String("method", c.Request.Method),
			slog.String("path", c.FullPath()),
			slog.String("stack", string(debug.Stack())),
		)
		c.AbortWithStatusJSON(http.StatusInternalServerError, Envelope{Data: nil, Error: &ErrorBody{Code: "internal", Message: "internal error"}})
	})
}

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
