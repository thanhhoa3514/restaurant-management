package auth

import (
	"context"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"restaurant-management/internal/platform/guest"
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

type SessionAuth struct {
	RestaurantID uuid.UUID
	SessionID    uuid.UUID
	TableID      uuid.UUID
}

type SessionValidator interface {
	ValidateSessionToken(ctx context.Context, token string) (SessionAuth, error)
}

func Issue(secret string, claims Claims, ttl time.Duration) (string, error) {
	now := time.Now()
	claims.RegisteredClaims = jwt.RegisteredClaims{
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
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
func QRSessionToken(v SessionValidator) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := strings.TrimSpace(c.GetHeader("X-Session-Token"))
		if token == "" {
			httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "missing session token"))
			c.Abort()
			return
		}
		session, err := v.ValidateSessionToken(c.Request.Context(), token)
		if err != nil {
			httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "invalid session token"))
			c.Abort()
			return
		}
		ctx := tenant.WithRestaurantID(c.Request.Context(), session.RestaurantID)
		ctx = guest.WithSession(ctx, guest.Session{SessionID: session.SessionID, TableID: session.TableID})
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}
