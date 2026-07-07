package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"restaurant-management/internal/modules/identity/domain"
	pg "restaurant-management/internal/platform/postgres"
	"restaurant-management/internal/shared/apperr"
)

type SessionRepository struct {
	pool      *pgxpool.Pool
	defaultRID uuid.UUID
}

func NewSessionRepository(pool *pgxpool.Pool, defaultRID uuid.UUID) *SessionRepository {
	return &SessionRepository{pool: pool, defaultRID: defaultRID}
}

func (r *SessionRepository) q(ctx context.Context) pg.Querier {
	return pg.QuerierFromContext(ctx, r.pool)
}

func (r *SessionRepository) CreateSession(ctx context.Context, s *domain.UserSession) error {
	_, err := r.q(ctx).Exec(ctx, `
		INSERT INTO user_sessions (id, restaurant_id, user_id, refresh_token_hash, device_info, ip_address, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, s.ID, s.RestaurantID, s.UserID, s.RefreshTokenHash, s.DeviceInfo, s.IPAddress, s.ExpiresAt)
	if err != nil {
		return err
	}
	return nil
}

func (r *SessionRepository) FindSessionByRefreshTokenHash(ctx context.Context, hash string) (*domain.UserSession, error) {
	s := &domain.UserSession{}
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, restaurant_id, user_id, refresh_token_hash, device_info, ip_address,
		       expires_at, revoked_at, created_at, last_used_at
		FROM user_sessions
		WHERE refresh_token_hash = $1
	`, hash).Scan(
		&s.ID, &s.RestaurantID, &s.UserID, &s.RefreshTokenHash,
		&s.DeviceInfo, &s.IPAddress, &s.ExpiresAt, &s.RevokedAt,
		&s.CreatedAt, &s.LastUsedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "session not found")
	}
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *SessionRepository) FindSessionByID(ctx context.Context, sessionID uuid.UUID) (*domain.UserSession, error) {
	s := &domain.UserSession{}
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, restaurant_id, user_id, refresh_token_hash, device_info, ip_address,
		       expires_at, revoked_at, created_at, last_used_at
		FROM user_sessions
		WHERE id = $1
	`, sessionID).Scan(
		&s.ID, &s.RestaurantID, &s.UserID, &s.RefreshTokenHash,
		&s.DeviceInfo, &s.IPAddress, &s.ExpiresAt, &s.RevokedAt,
		&s.CreatedAt, &s.LastUsedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "session not found")
	}
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *SessionRepository) RevokeSession(ctx context.Context, sessionID uuid.UUID) error {
	cmd, err := r.q(ctx).Exec(ctx, `
		UPDATE user_sessions
		SET revoked_at = NOW()
		WHERE id = $1 AND revoked_at IS NULL
	`, sessionID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return apperr.New(apperr.CodeNotFound, "session not found or already revoked")
	}
	return nil
}

func (r *SessionRepository) RevokeUserSessions(ctx context.Context, restaurantID, userID uuid.UUID) error {
	_, err := r.q(ctx).Exec(ctx, `
		UPDATE user_sessions
		SET revoked_at = NOW()
		WHERE restaurant_id = $1 AND user_id = $2 AND revoked_at IS NULL
	`, r.defaultRID, userID)
	return err
}

func (r *SessionRepository) IsSessionValid(ctx context.Context, sessionID uuid.UUID) (bool, error) {
	var revokedAt *time.Time
	err := r.q(ctx).QueryRow(ctx, `
		SELECT revoked_at FROM user_sessions WHERE id = $1
	`, sessionID).Scan(&revokedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return revokedAt == nil, nil
}

// ensure SessionRepository satisfies domain.SessionRepository
var _ domain.SessionRepository = (*SessionRepository)(nil)

// SessionConfig holds TTL for refresh tokens.
// It's kept in the repo package to avoid import cycles; the config is set
// from the application layer when creating the repo.
var RefreshTokenTTL = 7 * 24 * time.Hour // default: 7 days
