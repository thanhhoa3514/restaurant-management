package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/platform/tenant"
	"restaurant-management/internal/shared/apperr"
)

// gin context keys for the authenticated identity.
const (
	CtxUserID       = "user_id"
	CtxRole         = "role"
	CtxRestaurantID = "restaurant_id"
)

type Claims struct {
	UserID       string `json:"user_id"`
	RestaurantID string `json:"restaurant_id"`
	Role         string `json:"role"`
	jwt.RegisteredClaims
}

func JWT(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
		if token == "" {
			httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "missing bearer token"))
			c.Abort()
			return
		}
		var claims Claims
		parsed, err := jwt.ParseWithClaims(token, &claims,
			func(*jwt.Token) (any, error) { return []byte(secret), nil },
			jwt.WithValidMethods([]string{"HS256"}),
		)
		if err != nil || !parsed.Valid {
			httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "invalid token"))
			c.Abort()
			return
		}
		rid, err := uuid.Parse(claims.RestaurantID)
		if err != nil || rid == uuid.Nil {
			httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "invalid restaurant claim"))
			c.Abort()
			return
		}
		// RBAC reads role via gin keys; usecases read tenant via request context.
		c.Set(CtxUserID, claims.UserID)
		c.Set(CtxRole, claims.Role)
		c.Set(CtxRestaurantID, rid.String())
		c.Request = c.Request.WithContext(tenant.WithRestaurantID(c.Request.Context(), rid))
		c.Next()
	}
}
func RBAC(roles ...string) gin.HandlerFunc {
	allowed := map[string]struct{}{}
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(c *gin.Context) {
		role := c.GetString(CtxRole)
		if _, ok := allowed[role]; !ok && len(allowed) > 0 {
			httpx.RespondError(c, apperr.New(apperr.CodeForbidden, "forbidden"))
			c.Abort()
			return
		}
		c.Next()
	}
}
func QRSessionToken() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.AbortWithStatusJSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
	}
}
