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

func GuestSessionKey(c *gin.Context) string {
	session, ok := guest.SessionFromContext(c.Request.Context())
	if ok {
		return "guest:" + session.SessionID.String()
	}
	return ""
}

func StaffUserKey(c *gin.Context) string {
	userID := c.GetString("user_id")
	if userID != "" {
		return "staff:" + userID
	}
	return ""
}

func IPKey(c *gin.Context) string {
	return "ip:" + c.ClientIP()
}

func RespondRateLimited(c *gin.Context) {
	httpx.RespondError(c, apperr.New(apperr.CodeRateLimited, "too many requests, please try again later"))
	c.Abort()
}
