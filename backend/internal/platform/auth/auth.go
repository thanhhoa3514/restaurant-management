package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"restaurant-management/internal/platform/guest"
	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/shared/apperr"
)

const (
	CtxUserID    = "user_id"
	CtxRole      = "role"
	CtxSessionID = "session_id"
)

type Claims struct {
	UserID    string `json:"user_id"`
	Role      string `json:"role"`
	SessionID string `json:"session_id,omitempty"`
	jwt.RegisteredClaims
}

type SessionChecker interface {
	IsSessionValid(ctx context.Context, sessionID uuid.UUID) (bool, error)
}

func GenerateRefreshToken() (raw string, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	raw = hex.EncodeToString(b)
	sum := sha256.Sum256(b)
	hash = hex.EncodeToString(sum[:])
	return raw, hash, nil
}

func HashRefreshToken(raw string) string {
	b, err := hex.DecodeString(raw)
	if err != nil {
		sum := sha256.Sum256([]byte(raw))
		return hex.EncodeToString(sum[:])
	}
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

type DeviceAccessAuth struct {
	RestaurantID uuid.UUID
	SessionID    uuid.UUID
	TableID      uuid.UUID
}

type DeviceAccessValidator interface {
	ValidateAccessToken(ctx context.Context, token string) (DeviceAccessAuth, error)
}

func Issue(secret string, claims Claims, ttl time.Duration) (string, error) {
	now := time.Now()
	claims.RegisteredClaims = jwt.RegisteredClaims{
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

// Parse validates a raw staff JWT without depending on an HTTP transport.
// It is shared by the HTTP and WebSocket authentication paths.
func Parse(token, secret string) (*Claims, error) {
	token = strings.TrimSpace(strings.TrimPrefix(token, "Bearer "))
	if token == "" {
		return nil, errors.New("missing bearer token")
	}
	var claims Claims
	parsed, err := jwt.ParseWithClaims(
		token,
		&claims,
		func(*jwt.Token) (any, error) {
			return []byte(secret), nil
		},
		jwt.WithValidMethods([]string{"HS256"}),
	)
	if err != nil || !parsed.Valid {
		return nil, errors.New("invalid token")
	}
	return &claims, nil
}

func parseClaims(c *gin.Context, secret string) *Claims {
	token := c.GetHeader("Authorization")
	if strings.TrimSpace(strings.TrimPrefix(token, "Bearer ")) == "" {
		httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "missing bearer token"))
		c.Abort()
		return nil
	}
	claims, err := Parse(token, secret)
	if err != nil {
		httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "invalid token"))
		c.Abort()
		return nil
	}
	c.Set(CtxUserID, claims.UserID)
	c.Set(CtxRole, claims.Role)
	if claims.SessionID != "" {
		c.Set(CtxSessionID, claims.SessionID)
	}
	return claims
}

func JWT(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		parseClaims(c, secret)
	}
}

func JWTSession(secret string, checker SessionChecker) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := parseClaims(c, secret)
		if c.IsAborted() {
			return
		}
		if claims.SessionID == "" {
			c.Next()
			return
		}
		sid, err := uuid.Parse(claims.SessionID)
		if err != nil {
			httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "invalid session claim"))
			c.Abort()
			return
		}
		valid, err := checker.IsSessionValid(c.Request.Context(), sid)
		if err != nil {
			httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "session validation failed"))
			c.Abort()
			return
		}
		if !valid {
			httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "session revoked"))
			c.Abort()
			return
		}
		c.Next()
	}
}
func DeviceAccessToken(v DeviceAccessValidator) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := strings.TrimSpace(c.GetHeader("X-Device-Access-Token"))
		if token == "" {
			httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "missing device access token"))
			c.Abort()
			return
		}
		session, err := v.ValidateAccessToken(c.Request.Context(), token)
		if err != nil {
			httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "invalid device access token"))
			c.Abort()
			return
		}
		ctx := guest.WithSession(c.Request.Context(), guest.Session{
			RestaurantID: session.RestaurantID,
			SessionID:    session.SessionID,
			TableID:      session.TableID,
		})
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}
