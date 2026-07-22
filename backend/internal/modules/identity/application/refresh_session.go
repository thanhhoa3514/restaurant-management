package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/identity/domain"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/shared/apperr"
)

type RefreshSessionRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type RefreshSessionResponse struct {
	Token        string    `json:"token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type RefreshSession struct {
	sessions           domain.SessionRepository
	repo               domain.UserRepository
	jwtSecret          string
	jwtTTL             time.Duration
	defaultRestaurantID uuid.UUID
}

func NewRefreshSession(sessions domain.SessionRepository, repo domain.UserRepository, jwtSecret string, jwtTTL time.Duration, defaultRestaurantID uuid.UUID) *RefreshSession {
	return &RefreshSession{sessions: sessions, repo: repo, jwtSecret: jwtSecret, jwtTTL: jwtTTL, defaultRestaurantID: defaultRestaurantID}
}

func (s *RefreshSession) Handle(ctx context.Context, req RefreshSessionRequest) (RefreshSessionResponse, error) {
	var out RefreshSessionResponse
	if req.RefreshToken == "" {
		return out, apperr.New(apperr.CodeInvalid, "refresh_token is required")
	}

	hash := auth.HashRefreshToken(req.RefreshToken)
	session, err := s.sessions.FindSessionByRefreshTokenHash(ctx, hash)
	if err != nil {
		if apperr.Is(err, apperr.CodeNotFound) {
			return out, apperr.New(apperr.CodeUnauthorized, "invalid refresh token")
		}
		return out, err
	}

	// Check revocation.
	if session.RevokedAt != nil {
		return out, apperr.New(apperr.CodeUnauthorized, "refresh token revoked")
	}

	// Check expiry.
	if session.ExpiresAt.Before(time.Now()) {
		return out, apperr.New(apperr.CodeUnauthorized, "refresh token expired")
	}

	// Look up user to verify they are still active.
	user, err := s.repo.FindByID(ctx, s.defaultRestaurantID, session.UserID)
	if err != nil {
		if apperr.Is(err, apperr.CodeNotFound) {
			return out, apperr.New(apperr.CodeUnauthorized, "user not found")
		}
		return out, err
	}
	if user.Status == domain.UserStatusInactive || user.Status == domain.UserStatusLocked {
		_ = s.sessions.RevokeSession(ctx, session.ID)
		return out, apperr.New(apperr.CodeForbidden, "user is inactive or locked")
	}

	// Rotate: revoke old session, create a new one with a fresh ID and refresh token.
	newRaw, newHash, err := auth.GenerateRefreshToken()
	if err != nil {
		return out, err
	}
	if err := s.sessions.RevokeSession(ctx, session.ID); err != nil {
		return out, err
	}
	newSessionID := uuid.New()
	newSession := &domain.UserSession{
		ID:               newSessionID,
		RestaurantID:     session.RestaurantID,
		UserID:           session.UserID,
		RefreshTokenHash: newHash,
		ExpiresAt:        time.Now().Add(RefreshTokenTTL),
	}
	if err := s.sessions.CreateSession(ctx, newSession); err != nil {
		return out, err
	}

	now := time.Now()
	role := user.RoleName
	token, err := auth.Issue(s.jwtSecret, auth.Claims{
		UserID: user.ID.String(),
		Role:   role, SessionID: newSessionID.String(),
	}, s.jwtTTL)
	if err != nil {
		return out, err
	}

	return RefreshSessionResponse{
		Token:        token,
		RefreshToken: newRaw,
		ExpiresAt:    now.Add(s.jwtTTL),
	}, nil
}
