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

type Repository struct {
	pool      *pgxpool.Pool
	defaultRID uuid.UUID
}

func NewRepository(pool *pgxpool.Pool, defaultRID uuid.UUID) *Repository { return &Repository{pool: pool, defaultRID: defaultRID} }

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

func (r *Repository) UpdateSessionCustomerName(ctx context.Context, sessionID uuid.UUID, name string) error {
	_, err := r.q(ctx).Exec(ctx, `
		UPDATE dining_sessions
		SET customer_name = $1, updated_at = NOW()
		WHERE id = $2 AND deleted_at IS NULL
	`, name, sessionID)
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
	var qrCodeID, openedBy, mergeGroupID pgtype.UUID
	err := r.q(ctx).QueryRow(ctx, activeSessionSelect(`restaurant_id = $1 AND table_id = $2`), restaurantID, tableID).Scan(
		&s.ID, &s.RestaurantID, &s.TableID, &qrCodeID, &s.SessionCode, &s.SessionToken, &s.Status, &s.OpenedVia, &openedBy, &mergeGroupID, &s.Version, &s.ClosedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "active session not found")
	}
	if err != nil {
		return nil, err
	}
	fullSessionRow(s, &qrCodeID, &openedBy, &mergeGroupID)
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
		SELECT t.id, t.code, t.name, t.status, t.capacity,
		       COALESCE(a.name, ''), COALESCE(a.display_order, 0),
		       q.id, q.token
		FROM tables t
		LEFT JOIN areas a
		  ON a.id = t.area_id
		 AND a.deleted_at IS NULL
		LEFT JOIN qr_codes q
		  ON q.restaurant_id = t.restaurant_id
		 AND q.table_id = t.id
		 AND q.is_active = TRUE
		 AND q.deleted_at IS NULL
		WHERE t.restaurant_id = $1 AND t.deleted_at IS NULL
		ORDER BY COALESCE(a.display_order, 0), t.code
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
		if err := rows.Scan(&row.TableID, &row.TableCode, &row.TableName, &row.Status, &row.Capacity, &row.AreaName, &row.AreaOrder, &qrID, &token); err != nil {
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

func (r *Repository) CloseSession(ctx context.Context, restaurantID, sessionID uuid.UUID, closedBy *uuid.UUID) (*domain.DiningSession, bool, error) {
	s := &domain.DiningSession{}
	var qrCodeID, openedBy, mergeGroupID pgtype.UUID
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, restaurant_id, table_id, qr_code_id, session_code, COALESCE(session_token, ''), status, opened_via, opened_by, merge_group_id, version, closed_at
		FROM dining_sessions
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`, restaurantID, sessionID).Scan(
		&s.ID, &s.RestaurantID, &s.TableID, &qrCodeID, &s.SessionCode, &s.SessionToken, &s.Status, &s.OpenedVia, &openedBy, &mergeGroupID, &s.Version, &s.ClosedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, apperr.New(apperr.CodeNotFound, "dining session not found")
	}
	if err != nil {
		return nil, false, err
	}
	fullSessionRow(s, &qrCodeID, &openedBy, &mergeGroupID)
	if s.Status == domain.SessionClosed {
		return s, false, nil
	}
	if s.Status != domain.SessionActive && s.Status != domain.SessionAwaitingPayment {
		return nil, false, apperr.New(apperr.CodeConflict, "dining session is not closable")
	}

	var hasUnpaidInvoice bool
	if err := r.q(ctx).QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM invoices
			WHERE restaurant_id = $1
			  AND dining_session_id = $2
			  AND status <> 'VOID'
			  AND status <> 'PAID'
			  AND deleted_at IS NULL
		)
	`, restaurantID, sessionID).Scan(&hasUnpaidInvoice); err != nil {
		return nil, false, err
	}
	if hasUnpaidInvoice {
		return nil, false, apperr.New(apperr.CodeConflict, "session has unpaid invoice")
	}

	err = r.q(ctx).QueryRow(ctx, `
		UPDATE dining_sessions
		SET status = 'CLOSED',
		    closed_at = COALESCE(closed_at, NOW()),
		    closed_by = COALESCE(closed_by, $3),
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		RETURNING status, version, closed_at
	`, restaurantID, sessionID, closedBy).Scan(&s.Status, &s.Version, &s.ClosedAt)
	if err != nil {
		return nil, false, err
	}
	if _, err := r.q(ctx).Exec(ctx, `
		UPDATE tables
		SET status = 'AVAILABLE', version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, s.TableID); err != nil {
		return nil, false, err
	}
	return s, true, nil
}

func activeSessionSelect(where string) string {
	return `
		SELECT id, restaurant_id, table_id, qr_code_id, session_code, session_token, status, opened_via, opened_by, merge_group_id, version, closed_at
		FROM dining_sessions
		WHERE ` + where + `
		  AND status IN ('ACTIVE', 'AWAITING_PAYMENT')
		  AND deleted_at IS NULL
		ORDER BY opened_at DESC
		LIMIT 1
	`
}

func (r *Repository) FindSessionByID(ctx context.Context, restaurantID, sessionID uuid.UUID) (*domain.DiningSession, error) {
	s := &domain.DiningSession{}
	var qrCodeID, openedBy, mergeGroupID pgtype.UUID
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, restaurant_id, table_id, qr_code_id, session_code, session_token, status, opened_via, opened_by, merge_group_id, version, closed_at
		FROM dining_sessions
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, sessionID).Scan(
		&s.ID, &s.RestaurantID, &s.TableID, &qrCodeID, &s.SessionCode, &s.SessionToken, &s.Status, &s.OpenedVia, &openedBy, &mergeGroupID, &s.Version, &s.ClosedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "dining session not found")
	}
	if err != nil {
		return nil, err
	}
	fullSessionRow(s, &qrCodeID, &openedBy, &mergeGroupID)
	return s, nil
}

func (r *Repository) CreateMergeGroup(ctx context.Context, g *domain.MergeGroup) error {
	return r.q(ctx).QueryRow(ctx, `
		INSERT INTO table_merge_groups (restaurant_id, merged_by, note)
		VALUES ($1, $2, $3)
		RETURNING id
	`, g.RestaurantID, g.MergedBy, g.Note).Scan(&g.ID)
}

func (r *Repository) DeactivateMergeGroup(ctx context.Context, restaurantID, groupID uuid.UUID) error {
	_, err := r.q(ctx).Exec(ctx, `
		UPDATE table_merge_groups
		SET is_active = FALSE, version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND is_active = TRUE AND deleted_at IS NULL
	`, restaurantID, groupID)
	return err
}

func (r *Repository) FindActiveMergeGroup(ctx context.Context, restaurantID, groupID uuid.UUID) (*domain.MergeGroup, error) {
	g := &domain.MergeGroup{}
	var mergedBy pgtype.UUID
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, restaurant_id, merged_by, note, is_active, version, deleted_at
		FROM table_merge_groups
		WHERE restaurant_id = $1 AND id = $2 AND is_active = TRUE AND deleted_at IS NULL
	`, restaurantID, groupID).Scan(&g.ID, &g.RestaurantID, &mergedBy, &g.Note, &g.IsActive, &g.Version, &g.DeletedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "active merge group not found")
	}
	if err != nil {
		return nil, err
	}
	if mergedBy.Valid {
		id := uuid.UUID(mergedBy.Bytes)
		g.MergedBy = &id
	}
	return g, nil
}

// fullSessionRow scans a single dining_sessions row into a DiningSession, including merge_group_id.
func fullSessionRow(s *domain.DiningSession, qrCodeID, openedBy, mergeGroupID *pgtype.UUID) {
	if qrCodeID != nil && qrCodeID.Valid {
		id := uuid.UUID(qrCodeID.Bytes)
		s.QRCodeID = &id
	}
	if openedBy != nil && openedBy.Valid {
		id := uuid.UUID(openedBy.Bytes)
		s.OpenedBy = &id
	}
	if mergeGroupID != nil && mergeGroupID.Valid {
		id := uuid.UUID(mergeGroupID.Bytes)
		s.MergeGroupID = &id
	}
}

func (r *Repository) FindSessionsByMergeGroup(ctx context.Context, restaurantID, groupID uuid.UUID) ([]domain.DiningSession, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT id, restaurant_id, table_id, qr_code_id, session_code, session_token, status, opened_via, opened_by, merge_group_id, version, closed_at
		FROM dining_sessions
		WHERE restaurant_id = $1 AND merge_group_id = $2 AND status IN ('ACTIVE', 'AWAITING_PAYMENT') AND deleted_at IS NULL
		ORDER BY opened_at
	`, restaurantID, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.DiningSession
	for rows.Next() {
		var s domain.DiningSession
		var qrCodeID, openedBy, mergeGroupID pgtype.UUID
		if err := rows.Scan(&s.ID, &s.RestaurantID, &s.TableID, &qrCodeID, &s.SessionCode, &s.SessionToken, &s.Status, &s.OpenedVia, &openedBy, &mergeGroupID, &s.Version, &s.ClosedAt); err != nil {
			return nil, err
		}
		fullSessionRow(&s, &qrCodeID, &openedBy, &mergeGroupID)
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *Repository) UpdateSessionMergeGroup(ctx context.Context, sessionID uuid.UUID, mergeGroupID *uuid.UUID) error {
	_, err := r.q(ctx).Exec(ctx, `
		UPDATE dining_sessions
		SET merge_group_id = $2, version = version + 1, updated_at = NOW()
		WHERE id = $1 AND deleted_at IS NULL
	`, sessionID, mergeGroupID)
	return err
}
