package httpx

import (
	"bytes"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"restaurant-management/internal/platform/logger"
)

const maxBodyLogLen = 2 << 10

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

type bodyCaptureWriter struct {
	gin.ResponseWriter
	body bytes.Buffer
}

func (w *bodyCaptureWriter) Write(data []byte) (int, error) {
	w.body.Write(data)
	return w.ResponseWriter.Write(data)
}

func (w *bodyCaptureWriter) WriteString(s string) (int, error) {
	w.body.WriteString(s)
	return w.ResponseWriter.WriteString(s)
}

func Logger(base *slog.Logger, logResponseBody ...bool) gin.HandlerFunc {
	captureBody := len(logResponseBody) > 0 && logResponseBody[0]

	return func(c *gin.Context) {
		start := time.Now()
		id, _ := c.Get(requestIDKey)

		reqLog := base.With(slog.Any("request_id", id))
		c.Request = c.Request.WithContext(logger.WithContext(c.Request.Context(), reqLog))

		if captureBody {
			c.Writer = &bodyCaptureWriter{ResponseWriter: c.Writer}
		}

		c.Next()

		attrs := []any{
			slog.String("method", c.Request.Method),
			slog.String("path", c.FullPath()),
			slog.Int("status", c.Writer.Status()),
			slog.Duration("latency", time.Since(start)),
			slog.String("client_ip", c.ClientIP()),
		}
		if captureBody {
			bw := c.Writer.(*bodyCaptureWriter)
			if bw.body.Len() > 0 {
				body := bw.body.Bytes()
				if len(body) > maxBodyLogLen {
					body = body[:maxBodyLogLen]
				}
				attrs = append(attrs, slog.String("response", string(body)))
			}
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

func MaxBodyBytes(limit int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, limit)
		c.Next()
	}
}

func CORS(allowedOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = struct{}{}
	}
	return func(c *gin.Context) {
		if len(allowed) == 0 {
			c.Header("Access-Control-Allow-Origin", "*")
		} else if origin := c.GetHeader("Origin"); origin != "" {
			if _, ok := allowed[origin]; ok {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Vary", "Origin")
			}
		}
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
