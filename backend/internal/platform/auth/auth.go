package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"restaurant-management/internal/platform/guest"
	"restaurant-management/internal/platform/httpx"
	"restaurant-management/internal/shared/apperr"
)

// gin context keys for the authenticated identity.
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

// SessionChecker is the subset of SessionRepository needed to validate
// a session is still active. Defined here to avoid importing the identity
// domain from the platform layer.
type SessionChecker interface {
	IsSessionValid(ctx context.Context, sessionID uuid.UUID) (bool, error)
}

// GenerateRefreshToken produces a cryptographically random 32-byte token
// and returns the raw token (to give to the client) and its SHA-256 hash
// (to store in the database).
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

// HashRefreshToken returns the SHA-256 hex digest of a raw refresh token.
func HashRefreshToken(raw string) string {
	b, err := hex.DecodeString(raw)
	if err != nil {
		// If it's not hex-encoded, hash the string bytes directly.
		sum := sha256.Sum256([]byte(raw))
		return hex.EncodeToString(sum[:])
	}
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
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

// parseClaims is the shared JWT parsing logic used by JWT and JWTSession.
func parseClaims(c *gin.Context, secret string) *Claims {
	token := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
	if token == "" {
		httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "missing bearer token"))
		c.Abort()
		return nil
	}
	var claims Claims
	parsed, err := jwt.ParseWithClaims(token, &claims,
		func(*jwt.Token) (any, error) { return []byte(secret), nil },
		jwt.WithValidMethods([]string{"HS256"}),
	)
	if err != nil || !parsed.Valid {
		httpx.RespondError(c, apperr.New(apperr.CodeUnauthorized, "invalid token"))
		c.Abort()
		return nil
	}
	c.Set(CtxUserID, claims.UserID)
	c.Set(CtxRole, claims.Role)
	if claims.SessionID != "" {
		c.Set(CtxSessionID, claims.SessionID)
	}
	return &claims
}

func JWT(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		parseClaims(c, secret)
	}
}

// JWTSession is like JWT but also verifies that the session referenced in the
// JWT claims is still active (not revoked and not expired). Routes that should
// reject revoked sessions must use this instead of JWT.
func JWTSession(secret string, checker SessionChecker) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := parseClaims(c, secret)
		if c.IsAborted() {
			return
		}
		if claims.SessionID == "" {
			// Legacy token without session_id — skip session check.
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
		ctx := guest.WithSession(c.Request.Context(), guest.Session{SessionID: session.SessionID, TableID: session.TableID})
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}
