package postgres

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"restaurant-management/internal/modules/identity/domain"
	pg "restaurant-management/internal/platform/postgres"
	"restaurant-management/internal/shared/apperr"
)

type Repository struct {
	pool      *pgxpool.Pool
	defaultRID uuid.UUID
}

func NewRepository(pool *pgxpool.Pool, defaultRID uuid.UUID) *Repository { return &Repository{pool: pool, defaultRID: defaultRID} }

func (r *Repository) q(ctx context.Context) pg.Querier {
	return pg.QuerierFromContext(ctx, r.pool)
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

func (r *Repository) ListStaff(ctx context.Context) ([]domain.StaffUser, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT u.id, u.username, u.full_name, u.email, u.phone,
		       COALESCE(ro.name, ''), u.status, u.last_login_at, u.created_at
		FROM users u
		LEFT JOIN roles ro ON ro.id = u.role_id AND ro.deleted_at IS NULL
		WHERE u.restaurant_id = $1 AND u.deleted_at IS NULL
		ORDER BY u.created_at, u.username
	`, r.defaultRID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.StaffUser, 0)
	for rows.Next() {
		var u domain.StaffUser
		if err := rows.Scan(&u.ID, &u.Username, &u.FullName, &u.Email, &u.Phone, &u.RoleName, &u.Status, &u.LastLoginAt, &u.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (r *Repository) ListRoles(ctx context.Context) ([]domain.RoleInfo, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT id, name, display_name
		FROM roles
		WHERE deleted_at IS NULL
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.RoleInfo, 0)
	for rows.Next() {
		var ro domain.RoleInfo
		if err := rows.Scan(&ro.ID, &ro.Name, &ro.DisplayName); err != nil {
			return nil, err
		}
		out = append(out, ro)
	}
	return out, rows.Err()
}

func (r *Repository) FindRoleByName(ctx context.Context, name string) (*domain.RoleInfo, error) {
	ro := &domain.RoleInfo{}
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, name, display_name
		FROM roles
		WHERE name = $1 AND deleted_at IS NULL
	`, strings.ToLower(strings.TrimSpace(name))).Scan(&ro.ID, &ro.Name, &ro.DisplayName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "role not found")
	}
	if err != nil {
		return nil, err
	}
	return ro, nil
}

func (r *Repository) CreateUser(ctx context.Context, u domain.NewUser) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.q(ctx).QueryRow(ctx, `
		INSERT INTO users (restaurant_id, username, email, phone, password_hash, full_name, role_id, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
		RETURNING id
	`, u.RestaurantID, u.Username, u.Email, u.Phone, u.PasswordHash, u.FullName, u.RoleID).Scan(&id)
	if isUniqueViolation(err) {
		return uuid.Nil, apperr.New(apperr.CodeConflict, "username, email or phone already in use")
	}
	return id, err
}

func (r *Repository) UpdateUser(ctx context.Context, restaurantID, userID uuid.UUID, upd domain.UserUpdate) error {
	cmd, err := r.q(ctx).Exec(ctx, `
		UPDATE users
		SET full_name = COALESCE($3, full_name),
		    email     = COALESCE($4, email),
		    phone     = COALESCE($5, phone),
		    role_id   = COALESCE($6, role_id),
		    version   = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, userID, upd.FullName, upd.Email, upd.Phone, upd.RoleID)
	if isUniqueViolation(err) {
		return apperr.New(apperr.CodeConflict, "email or phone already in use")
	}
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return apperr.New(apperr.CodeNotFound, "user not found")
	}
	return nil
}

func (r *Repository) SetUserStatus(ctx context.Context, restaurantID, userID uuid.UUID, status domain.UserStatus) error {
	cmd, err := r.q(ctx).Exec(ctx, `
		UPDATE users
		SET status = $3, version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, userID, status)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return apperr.New(apperr.CodeNotFound, "user not found")
	}
	return nil
}

func (r *Repository) SetUserPassword(ctx context.Context, restaurantID, userID uuid.UUID, passwordHash string) error {
	cmd, err := r.q(ctx).Exec(ctx, `
		UPDATE users
		SET password_hash = $3, failed_login_attempts = 0, locked_until = NULL,
		    version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, userID, passwordHash)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return apperr.New(apperr.CodeNotFound, "user not found")
	}
	return nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
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
