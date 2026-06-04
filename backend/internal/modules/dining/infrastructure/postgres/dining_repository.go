package postgres

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/platform/auth"
	pg "restaurant-management/internal/platform/postgres"
	"restaurant-management/internal/shared/apperr"
)

type Repository struct{ pool *pgxpool.Pool }

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

func (r *Repository) q(ctx context.Context) pg.Querier { return pg.QuerierFromContext(ctx, r.pool) }

func (r *Repository) FindTable(ctx context.Context, restaurantID, tableID uuid.UUID) (*domain.Table, error) {
	t := &domain.Table{}
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, restaurant_id, COALESCE(area_id, '00000000-0000-0000-0000-000000000000'::uuid), code, name, version, deleted_at
		FROM tables
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, tableID).Scan(&t.ID, &t.RestaurantID, &t.AreaID, &t.Code, &t.Name, &t.Version, &t.DeletedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "table not found")
	}
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *Repository) ActiveQRForTable(ctx context.Context, restaurantID, tableID uuid.UUID) (*domain.QRCode, error) {
	qr := &domain.QRCode{}
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, restaurant_id, table_id, token, is_active
		FROM qr_codes
		WHERE restaurant_id = $1 AND table_id = $2 AND is_active = TRUE AND deleted_at IS NULL
		ORDER BY activated_at DESC
		LIMIT 1
	`, restaurantID, tableID).Scan(&qr.ID, &qr.RestaurantID, &qr.TableID, &qr.Token, &qr.IsActive)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return qr, nil
}

func (r *Repository) CreateSession(ctx context.Context, s *domain.DiningSession) error {
	err := r.q(ctx).QueryRow(ctx, `
		INSERT INTO dining_sessions (restaurant_id, table_id, qr_code_id, session_code, session_token, status, opened_by, opened_via)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`, s.RestaurantID, s.TableID, s.QRCodeID, s.SessionCode, s.SessionToken, s.Status, s.OpenedBy, s.OpenedVia).Scan(&s.ID)
	if pg.IsUniqueViolation(err) {
		return apperr.New(apperr.CodeConflict, "active session already exists")
	}
	return err
}

func (r *Repository) FindQRByToken(ctx context.Context, qrToken string) (*domain.QRCode, error) {
	qr := &domain.QRCode{}
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, restaurant_id, table_id, token, is_active
		FROM qr_codes
		WHERE token = $1 AND deleted_at IS NULL
	`, strings.TrimSpace(qrToken)).Scan(&qr.ID, &qr.RestaurantID, &qr.TableID, &qr.Token, &qr.IsActive)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "qr token not found")
	}
	if err != nil {
		return nil, err
	}
	return qr, nil
}

func (r *Repository) FindActiveSessionByTable(ctx context.Context, restaurantID, tableID uuid.UUID) (*domain.DiningSession, error) {
	s := &domain.DiningSession{}
	var qrCodeID, openedBy pgtype.UUID
	err := r.q(ctx).QueryRow(ctx, activeSessionSelect(`restaurant_id = $1 AND table_id = $2`), restaurantID, tableID).Scan(
		&s.ID, &s.RestaurantID, &s.TableID, &qrCodeID, &s.SessionCode, &s.SessionToken, &s.Status, &s.OpenedVia, &openedBy, &s.Version, &s.ClosedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "active session not found")
	}
	if err != nil {
		return nil, err
	}
	if qrCodeID.Valid {
		id := uuid.UUID(qrCodeID.Bytes)
		s.QRCodeID = &id
	}
	if openedBy.Valid {
		id := uuid.UUID(openedBy.Bytes)
		s.OpenedBy = &id
	}
	return s, nil
}

func (r *Repository) ValidateSessionToken(ctx context.Context, token string) (auth.SessionAuth, error) {
	var out auth.SessionAuth
	err := r.q(ctx).QueryRow(ctx, `
		SELECT restaurant_id, id, table_id
		FROM dining_sessions
		WHERE session_token = $1
		  AND status IN ('ACTIVE', 'AWAITING_PAYMENT')
		  AND deleted_at IS NULL
	`, strings.TrimSpace(token)).Scan(&out.RestaurantID, &out.SessionID, &out.TableID)
	if errors.Is(err, pgx.ErrNoRows) {
		return auth.SessionAuth{}, apperr.New(apperr.CodeUnauthorized, "invalid session token")
	}
	if err != nil {
		return auth.SessionAuth{}, err
	}
	return out, nil
}

func (r *Repository) ListTablesWithActiveQR(ctx context.Context, restaurantID uuid.UUID) ([]domain.TableWithQR, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT t.id, t.code, t.name, t.status, q.id, q.token
		FROM tables t
		LEFT JOIN qr_codes q
		  ON q.restaurant_id = t.restaurant_id
		 AND q.table_id = t.id
		 AND q.is_active = TRUE
		 AND q.deleted_at IS NULL
		WHERE t.restaurant_id = $1 AND t.deleted_at IS NULL
		ORDER BY t.code
	`, restaurantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.TableWithQR, 0)
	for rows.Next() {
		var row domain.TableWithQR
		var qrID pgtype.UUID
		var token pgtype.Text
		if err := rows.Scan(&row.TableID, &row.TableCode, &row.TableName, &row.Status, &qrID, &token); err != nil {
			return nil, err
		}
		if qrID.Valid {
			id := uuid.UUID(qrID.Bytes)
			row.QRCodeID = &id
		}
		if token.Valid {
			t := token.String
			row.QRToken = &t
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) DeactivateActiveQR(ctx context.Context, restaurantID, tableID uuid.UUID, deactivatedBy *uuid.UUID, reason string) error {
	_, err := r.q(ctx).Exec(ctx, `
		UPDATE qr_codes
		SET is_active = FALSE, deactivated_at = NOW(), deactivated_by = $3, deactivated_reason = $4
		WHERE restaurant_id = $1 AND table_id = $2 AND is_active = TRUE AND deleted_at IS NULL
	`, restaurantID, tableID, deactivatedBy, reason)
	return err
}

func (r *Repository) CreateQR(ctx context.Context, qr *domain.QRCode) error {
	err := r.q(ctx).QueryRow(ctx, `
		INSERT INTO qr_codes (restaurant_id, table_id, token, is_active, created_by)
		VALUES ($1, $2, $3, TRUE, $4)
		RETURNING id
	`, qr.RestaurantID, qr.TableID, qr.Token, qr.CreatedBy).Scan(&qr.ID)
	if pg.IsUniqueViolation(err) {
		return apperr.New(apperr.CodeConflict, "active qr already exists for table")
	}
	return err
}

func activeSessionSelect(where string) string {
	return `
		SELECT id, restaurant_id, table_id, qr_code_id, session_code, session_token, status, opened_via, opened_by, version, closed_at
		FROM dining_sessions
		WHERE ` + where + `
		  AND status IN ('ACTIVE', 'AWAITING_PAYMENT')
		  AND deleted_at IS NULL
		ORDER BY opened_at DESC
		LIMIT 1
	`
}
