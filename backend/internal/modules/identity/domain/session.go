package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type UserSession struct {
	ID               uuid.UUID
	RestaurantID     uuid.UUID
	UserID           uuid.UUID
	RefreshTokenHash string
	DeviceInfo       *string
	IPAddress        *string
	ExpiresAt        time.Time
	RevokedAt        *time.Time
	CreatedAt        time.Time
	LastUsedAt       *time.Time
}

type SessionRepository interface {
	CreateSession(ctx context.Context, s *UserSession) error
	FindSessionByRefreshTokenHash(ctx context.Context, hash string) (*UserSession, error)
	FindSessionByID(ctx context.Context, sessionID uuid.UUID) (*UserSession, error)
	RevokeSession(ctx context.Context, sessionID uuid.UUID) error
	RevokeUserSessions(ctx context.Context, restaurantID, userID uuid.UUID) error
	IsSessionValid(ctx context.Context, sessionID uuid.UUID) (bool, error)
}
