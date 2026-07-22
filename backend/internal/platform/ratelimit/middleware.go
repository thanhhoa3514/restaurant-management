package ratelimit

import (
	"github.com/gin-gonic/gin"

	"restaurant-management/internal/platform/guest"
	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/shared/apperr"
)

type KeyFunc func(*gin.Context) string

func (sw *SlidingWindow) Middleware(keyFn KeyFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := keyFn(c)
		if key == "" {
			c.Next()
			return
		}
		if !sw.Allow(key) {
			httpx.RespondError(c, apperr.New(apperr.CodeRateLimited, "too many requests, please try again later"))
			c.Abort()
			return
		}
		c.Next()
	}
}

// GuestSessionKey extracts the session ID from the context as the rate limit key.
// Should be used after auth.QRSessionToken middleware.
func GuestSessionKey(c *gin.Context) string {
	session, ok := guest.SessionFromContext(c.Request.Context())
	if ok {
		return "guest:" + session.SessionID.String()
	}
	return ""
}

// StaffUserKey extracts the user ID from JWT context as the rate limit key.
func StaffUserKey(c *gin.Context) string {
	userID := c.GetString("user_id")
	if userID != "" {
		return "staff:" + userID
	}
	return ""
}

// IPKey uses the client IP as the rate limit key (for public endpoints).
func IPKey(c *gin.Context) string {
	return "ip:" + c.ClientIP()
}

// RespondRateLimited is a direct helper to abort with 429 from any handler.
func RespondRateLimited(c *gin.Context) {
	httpx.RespondError(c, apperr.New(apperr.CodeRateLimited, "too many requests, please try again later"))
	c.Abort()
}
