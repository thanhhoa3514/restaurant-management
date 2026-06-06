package postgres

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"restaurant-management/internal/modules/identity/domain"
	pg "restaurant-management/internal/platform/postgres"
	"restaurant-management/internal/shared/apperr"
)

type Repository struct{ pool *pgxpool.Pool }

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

func (r *Repository) q(ctx context.Context) pg.Querier {
	return pg.QuerierFromContext(ctx, r.pool)
}

func (r *Repository) ResolveRestaurantIDByCode(ctx context.Context, code string) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id
		FROM restaurants
		WHERE code = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
	`, strings.ToUpper(strings.TrimSpace(code))).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, apperr.New(apperr.CodeNotFound, "restaurant not found")
	}
	if err != nil {
		return uuid.Nil, err
	}
	return id, nil
}

func (r *Repository) FindByUsername(ctx context.Context, restaurantID uuid.UUID, username string) (*domain.User, error) {
	user := &domain.User{}
	err := r.q(ctx).QueryRow(ctx, `
		SELECT u.id, u.restaurant_id, u.username, u.password_hash, u.full_name,
		       u.status, u.role_id, COALESCE(ro.name, ''), u.locked_until,
		       u.version, u.deleted_at
		FROM users u
		LEFT JOIN roles ro ON ro.id = u.role_id AND ro.deleted_at IS NULL
		WHERE u.restaurant_id = $1
		  AND u.username = $2
		  AND u.deleted_at IS NULL
	`, restaurantID, strings.TrimSpace(username)).Scan(
		&user.ID,
		&user.RestaurantID,
		&user.Username,
		&user.PasswordHash,
		&user.FullName,
		&user.Status,
		&user.RoleID,
		&user.RoleName,
		&user.LockedUntil,
		&user.Version,
		&user.DeletedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "user not found")
	}
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *Repository) FindByID(ctx context.Context, restaurantID, userID uuid.UUID) (*domain.User, error) {
	user := &domain.User{}
	err := r.q(ctx).QueryRow(ctx, `
		SELECT u.id, u.restaurant_id, u.username, u.password_hash, u.full_name,
		       u.status, u.role_id, COALESCE(ro.name, ''), u.locked_until,
		       u.version, u.deleted_at
		FROM users u
		LEFT JOIN roles ro ON ro.id = u.role_id AND ro.deleted_at IS NULL
		WHERE u.restaurant_id = $1
		  AND u.id = $2
		  AND u.deleted_at IS NULL
	`, restaurantID, userID).Scan(
		&user.ID,
		&user.RestaurantID,
		&user.Username,
		&user.PasswordHash,
		&user.FullName,
		&user.Status,
		&user.RoleID,
		&user.RoleName,
		&user.LockedUntil,
		&user.Version,
		&user.DeletedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "user not found")
	}
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *Repository) ResolvePermissionCodes(ctx context.Context, restaurantID, userID uuid.UUID) ([]string, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT p.code
		FROM users u
		JOIN role_permissions rp ON rp.role_id = u.role_id
		JOIN permissions p ON p.id = rp.permission_id AND p.deleted_at IS NULL
		WHERE u.restaurant_id = $1
		  AND u.id = $2
		  AND u.deleted_at IS NULL
		ORDER BY p.module, p.code
	`, restaurantID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	codes := make([]string, 0, 8)
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err != nil {
			return nil, err
		}
		codes = append(codes, code)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return codes, nil
}

func (r *Repository) RecordLoginSuccess(ctx context.Context, restaurantID, userID uuid.UUID) error {
	cmd, err := r.q(ctx).Exec(ctx, `
		UPDATE users
		SET last_login_at = NOW(), failed_login_attempts = 0, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, userID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return apperr.New(apperr.CodeNotFound, "user not found")
	}
	return nil
}

func (r *Repository) RecordLoginFailure(ctx context.Context, restaurantID, userID uuid.UUID) error {
	cmd, err := r.q(ctx).Exec(ctx, `
		UPDATE users
		SET failed_login_attempts = failed_login_attempts + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, userID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return apperr.New(apperr.CodeNotFound, "user not found")
	}
	return nil
}
