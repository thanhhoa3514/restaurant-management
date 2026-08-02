package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"restaurant-management/internal/modules/dining/domain"
	"restaurant-management/internal/platform/auth"
	pg "restaurant-management/internal/platform/postgres"
	"restaurant-management/internal/shared/apperr"
)

type Repository struct {
	pool       *pgxpool.Pool
	defaultRID uuid.UUID
}

func NewRepository(pool *pgxpool.Pool, defaultRID uuid.UUID) *Repository {
	return &Repository{pool: pool, defaultRID: defaultRID}
}

func (r *Repository) q(ctx context.Context) pg.Querier { return pg.QuerierFromContext(ctx, r.pool) }

func (r *Repository) FindTable(ctx context.Context, restaurantID, tableID uuid.UUID) (*domain.Table, error) {
	t := &domain.Table{}
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, restaurant_id, COALESCE(area_id, '00000000-0000-0000-0000-000000000000'::uuid), code, name, capacity, status, position_x, position_y, version, deleted_at
		FROM tables
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, tableID).Scan(&t.ID, &t.RestaurantID, &t.AreaID, &t.Code, &t.Name, &t.Capacity, &t.Status, &t.PositionX, &t.PositionY, &t.Version, &t.DeletedAt)
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
		INSERT INTO dining_sessions (restaurant_id, table_id, qr_code_id, session_code, session_token, status, opened_by, opened_via, customer_name)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`, s.RestaurantID, s.TableID, s.QRCodeID, s.SessionCode, s.SessionToken, s.Status, s.OpenedBy, s.OpenedVia, s.CustomerName).Scan(&s.ID)
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
	// A token is only a usable ordering credential once its device is APPROVED
	// by a waiter — that is the whole confirmation gate. A PENDING device (a
	// freshly shared link, or the first guest before verification) is rejected
	// here, so it cannot open the guest websocket or reach any ordering route;
	// it polls DeviceStatus over plain HTTP until approved instead.
	//
	// Keep a short read window after checkout so the guest can receive the final
	// payment event, refresh once, and download the receipt. Domain write paths
	// still reject CLOSED sessions.
	err := r.q(ctx).QueryRow(ctx, `
		SELECT ds.restaurant_id, ds.id, ds.table_id
		FROM session_devices sd
		JOIN dining_sessions ds ON ds.id = sd.session_id
		WHERE sd.session_token = $1
		  AND sd.status = 'APPROVED'
		  AND (
		      ds.status IN ('ACTIVE', 'AWAITING_PAYMENT')
		      OR (ds.status = 'CLOSED' AND ds.closed_at >= NOW() - INTERVAL '30 minutes')
		  )
		  AND ds.deleted_at IS NULL
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
		       a.id, COALESCE(a.name, ''), COALESCE(a.display_order, 0),
		       t.position_x, t.position_y,
		       q.id, q.token,
		       EXISTS (
		           SELECT 1 FROM dining_sessions ds
		           WHERE ds.restaurant_id = t.restaurant_id
		             AND ds.table_id = t.id
		             AND ds.status IN ('ACTIVE', 'AWAITING_PAYMENT')
		             AND ds.deleted_at IS NULL
		       ) AS has_active_session
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
		var areaID pgtype.UUID
		var token pgtype.Text
		var posX, posY pgtype.Int4
		if err := rows.Scan(&row.TableID, &row.TableCode, &row.TableName, &row.Status, &row.Capacity, &areaID, &row.AreaName, &row.AreaOrder, &posX, &posY, &qrID, &token, &row.HasActiveSession); err != nil {
			return nil, err
		}
		if posX.Valid && posY.Valid {
			x, y := int(posX.Int32), int(posY.Int32)
			row.PositionX, row.PositionY = &x, &y
		}
		if areaID.Valid {
			id := uuid.UUID(areaID.Bytes)
			row.AreaID = &id
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

	closingIDs := []uuid.UUID{sessionID}
	if s.MergeGroupID != nil {
		rows, err := r.q(ctx).Query(ctx, `
			SELECT id
			FROM dining_sessions
			WHERE restaurant_id = $1 AND merge_group_id = $2 AND deleted_at IS NULL
		`, restaurantID, *s.MergeGroupID)
		if err != nil {
			return nil, false, err
		}
		closingIDs = closingIDs[:0]
		for rows.Next() {
			var id uuid.UUID
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				return nil, false, err
			}
			closingIDs = append(closingIDs, id)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return nil, false, err
		}
	}

	var hasUnpaidInvoice bool
	if err := r.q(ctx).QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM invoices
			WHERE restaurant_id = $1
			  AND dining_session_id = ANY($2)
			  AND status <> 'VOID'
			  AND status <> 'PAID'
			  AND deleted_at IS NULL
		)
	`, restaurantID, closingIDs).Scan(&hasUnpaidInvoice); err != nil {
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
	if len(closingIDs) > 1 {
		if _, err := r.q(ctx).Exec(ctx, `
			UPDATE dining_sessions
			SET status = 'CLOSED',
			    closed_at = COALESCE(closed_at, NOW()),
			    closed_by = COALESCE(closed_by, $3),
			    version = version + 1,
			    updated_at = NOW()
			WHERE restaurant_id = $1 AND id = ANY($2) AND status <> 'CLOSED' AND deleted_at IS NULL
		`, restaurantID, closingIDs, closedBy); err != nil {
			return nil, false, err
		}
		if _, err := r.q(ctx).Exec(ctx, `
			UPDATE table_merge_groups
			SET is_active = FALSE, version = version + 1, updated_at = NOW()
			WHERE restaurant_id = $1 AND id = $2
		`, restaurantID, *s.MergeGroupID); err != nil {
			return nil, false, err
		}
	}

	if _, err := r.q(ctx).Exec(ctx, `
		UPDATE tables
		SET status = 'AVAILABLE', version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND deleted_at IS NULL
		  AND id IN (SELECT table_id FROM dining_sessions WHERE restaurant_id = $1 AND id = ANY($2))
	`, restaurantID, closingIDs); err != nil {
		return nil, false, err
	}
	return s, true, nil
}

// AbandonPendingSession closes a session that never activated (owner rejected
// at the join gate). Soft-deleting it clears the one-open-per-table unique
// index so the table can be re-opened; CloseSession refuses non-ACTIVE
// sessions, so this is a separate, narrower path. Also frees the table row.
func (r *Repository) AbandonPendingSession(ctx context.Context, restaurantID, sessionID uuid.UUID, closedBy *uuid.UUID) error {
	tag, err := r.q(ctx).Exec(ctx, `
		UPDATE dining_sessions
		SET status = 'CLOSED',
		    deleted_at = NOW(),
		    closed_at = COALESCE(closed_at, NOW()),
		    closed_by = COALESCE(closed_by, $3),
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2
		  AND status = 'PENDING_VERIFICATION' AND deleted_at IS NULL
	`, restaurantID, sessionID, closedBy)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return nil
	}
	// Every phone waiting on the abandoned session must receive a terminal
	// status instead of polling PENDING forever. This runs in the caller's
	// transaction together with the session soft-delete.
	if _, err := r.q(ctx).Exec(ctx, `
		UPDATE session_devices
		SET status = 'REJECTED',
		    approved_by = $3,
		    approved_at = NOW(),
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND session_id = $2 AND status = 'PENDING'
	`, restaurantID, sessionID, closedBy); err != nil {
		return err
	}
	_, err = r.q(ctx).Exec(ctx, `
		UPDATE tables
		SET status = 'AVAILABLE', version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND deleted_at IS NULL
		  AND id = (SELECT table_id FROM dining_sessions WHERE restaurant_id = $1 AND id = $2)
	`, restaurantID, sessionID)
	return err
}

func activeSessionSelect(where string) string {
	return `
		SELECT id, restaurant_id, table_id, qr_code_id, session_code, session_token, status, opened_via, opened_by, merge_group_id, version, closed_at
		FROM dining_sessions
		WHERE ` + where + `
		  AND status IN ('PENDING_VERIFICATION', 'ACTIVE', 'AWAITING_PAYMENT')
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

func (r *Repository) FindSessionsPendingVerification(ctx context.Context, restaurantID uuid.UUID) ([]domain.DiningSession, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT id, restaurant_id, table_id, qr_code_id, session_code, session_token, status, opened_via, opened_by, merge_group_id, version, closed_at
		FROM dining_sessions
		WHERE restaurant_id = $1 AND status = 'PENDING_VERIFICATION' AND deleted_at IS NULL
		ORDER BY opened_at
	`, restaurantID)
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

func (r *Repository) VerifySession(ctx context.Context, restaurantID, sessionID uuid.UUID, verifiedBy *uuid.UUID) error {
	tag, err := r.q(ctx).Exec(ctx, `
		UPDATE dining_sessions
		SET status = 'ACTIVE',
		    opened_by = $3,
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1
		  AND id = $2
		  AND status = 'PENDING_VERIFICATION'
		  AND deleted_at IS NULL
	`, restaurantID, sessionID, verifiedBy)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.New(apperr.CodeNotFound, "pending session not found")
	}
	return nil
}

func (r *Repository) CreateSessionDevice(ctx context.Context, d *domain.SessionDevice) error {
	err := r.q(ctx).QueryRow(ctx, `
		INSERT INTO session_devices (restaurant_id, session_id, device_id, guest_name, status, session_token, is_owner)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, d.RestaurantID, d.SessionID, d.DeviceID, d.GuestName, string(d.Status), d.SessionToken, d.IsOwner).Scan(&d.ID)
	if pg.IsUniqueViolation(err) {
		return apperr.New(apperr.CodeConflict, "device already joined this session")
	}
	return err
}

const sessionDeviceSelect = `
	SELECT id, restaurant_id, session_id, device_id, COALESCE(guest_name, ''), status, session_token, is_owner, approved_by, approved_at
	FROM session_devices
`

func scanSessionDevice(row pgx.Row) (*domain.SessionDevice, error) {
	d := &domain.SessionDevice{}
	var status string
	var approvedBy pgtype.UUID
	var approvedAt pgtype.Timestamptz
	if err := row.Scan(&d.ID, &d.RestaurantID, &d.SessionID, &d.DeviceID, &d.GuestName, &status, &d.SessionToken, &d.IsOwner, &approvedBy, &approvedAt); err != nil {
		return nil, err
	}
	d.Status = domain.DeviceStatus(status)
	if approvedBy.Valid {
		id := uuid.UUID(approvedBy.Bytes)
		d.ApprovedBy = &id
	}
	if approvedAt.Valid {
		t := approvedAt.Time
		d.ApprovedAt = &t
	}
	return d, nil
}

func (r *Repository) FindSessionDevice(ctx context.Context, sessionID uuid.UUID, deviceID string) (*domain.SessionDevice, error) {
	d, err := scanSessionDevice(r.q(ctx).QueryRow(ctx, sessionDeviceSelect+`WHERE session_id = $1 AND device_id = $2`, sessionID, deviceID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "device not found")
	}
	return d, err
}

func (r *Repository) FindSessionDeviceByID(ctx context.Context, restaurantID, rowID uuid.UUID) (*domain.SessionDevice, error) {
	d, err := scanSessionDevice(r.q(ctx).QueryRow(ctx, sessionDeviceSelect+`WHERE restaurant_id = $1 AND id = $2`, restaurantID, rowID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "device not found")
	}
	return d, err
}

func (r *Repository) FindDeviceByToken(ctx context.Context, token string) (*domain.SessionDevice, error) {
	d, err := scanSessionDevice(r.q(ctx).QueryRow(ctx, sessionDeviceSelect+`WHERE session_token = $1`, strings.TrimSpace(token)))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "device not found")
	}
	return d, err
}

func (r *Repository) FindPendingDevices(ctx context.Context, restaurantID uuid.UUID) ([]domain.PendingDeviceDTO, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT sd.id, sd.session_id, sd.guest_name, sd.is_owner, sd.created_at,
		       ds.table_id, t.code, t.name
		FROM session_devices sd
		JOIN dining_sessions ds ON ds.id = sd.session_id AND ds.deleted_at IS NULL
		JOIN tables t ON t.id = ds.table_id
		WHERE sd.restaurant_id = $1
		  AND sd.status = 'PENDING'
		  AND ds.status IN ('PENDING_VERIFICATION', 'ACTIVE', 'AWAITING_PAYMENT')
		ORDER BY sd.created_at
	`, restaurantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.PendingDeviceDTO, 0)
	for rows.Next() {
		var d domain.PendingDeviceDTO
		if err := rows.Scan(&d.DeviceID, &d.SessionID, &d.GuestName, &d.IsOwner, &d.CreatedAt, &d.TableID, &d.TableCode, &d.TableName); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *Repository) SetDeviceStatus(ctx context.Context, restaurantID, rowID uuid.UUID, status domain.DeviceStatus, actorID *uuid.UUID) (*domain.SessionDevice, error) {
	// Only PENDING devices transition — makes approve/reject idempotent-safe and
	// blocks re-approving a device the waiter already rejected.
	d, err := scanSessionDevice(r.q(ctx).QueryRow(ctx, `
		UPDATE session_devices
		SET status = $3,
		    approved_by = $4,
		    approved_at = NOW(),
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND status = 'PENDING'
		RETURNING id, restaurant_id, session_id, device_id, COALESCE(guest_name, ''), status, session_token, is_owner, approved_by, approved_at
	`, restaurantID, rowID, string(status), actorID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeConflict, "device is not pending")
	}
	return d, err
}

func (r *Repository) ListAreas(ctx context.Context, restaurantID uuid.UUID) ([]domain.Area, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT id, restaurant_id, name, COALESCE(description, ''), display_order, is_active
		FROM areas
		WHERE restaurant_id = $1 AND deleted_at IS NULL
		ORDER BY display_order, name
	`, restaurantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.Area, 0)
	for rows.Next() {
		var a domain.Area
		if err := rows.Scan(&a.ID, &a.RestaurantID, &a.Name, &a.Description, &a.DisplayOrder, &a.IsActive); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func duplicateTableCode(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && strings.Contains(pgErr.ConstraintName, "tables_restaurant_code") {
		return apperr.New(apperr.CodeConflict, "table code already exists")
	}
	return err
}

func (r *Repository) CreateTable(ctx context.Context, t *domain.Table) error {
	var areaID any
	if t.AreaID != uuid.Nil {
		areaID = t.AreaID
	}
	err := r.q(ctx).QueryRow(ctx, `
		INSERT INTO tables (restaurant_id, area_id, code, name, capacity, status, position_x, position_y)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, version
	`, t.RestaurantID, areaID, t.Code, t.Name, t.Capacity, t.Status, t.PositionX, t.PositionY).Scan(&t.ID, &t.Version)
	if err != nil {
		return duplicateTableCode(err)
	}
	return nil
}

func (r *Repository) UpdateTable(ctx context.Context, t *domain.Table) error {
	var areaID any
	if t.AreaID != uuid.Nil {
		areaID = t.AreaID
	}
	tag, err := r.q(ctx).Exec(ctx, `
		UPDATE tables
		SET area_id = $3, code = $4, name = $5, capacity = $6, status = $7,
		    position_x = COALESCE($8, position_x), position_y = COALESCE($9, position_y),
		    version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, t.RestaurantID, t.ID, areaID, t.Code, t.Name, t.Capacity, t.Status, t.PositionX, t.PositionY)
	if err != nil {
		return duplicateTableCode(err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.New(apperr.CodeNotFound, "table not found")
	}
	return nil
}

// UpdateTablePositions lưu cả sơ đồ bàn trong một câu lệnh — kéo-thả xong bấm lưu một lần.
func (r *Repository) UpdateTablePositions(ctx context.Context, restaurantID uuid.UUID, positions []domain.TablePosition) error {
	if len(positions) == 0 {
		return nil
	}
	ids := make([]uuid.UUID, len(positions))
	xs := make([]int32, len(positions))
	ys := make([]int32, len(positions))
	for i, p := range positions {
		ids[i], xs[i], ys[i] = p.TableID, int32(p.X), int32(p.Y)
	}
	_, err := r.q(ctx).Exec(ctx, `
		UPDATE tables t
		SET position_x = v.x, position_y = v.y, updated_at = NOW()
		FROM (SELECT UNNEST($2::uuid[]) AS id, UNNEST($3::int[]) AS x, UNNEST($4::int[]) AS y) v
		WHERE t.restaurant_id = $1 AND t.id = v.id AND t.deleted_at IS NULL
	`, restaurantID, ids, xs, ys)
	return err
}

func (r *Repository) SoftDeleteTable(ctx context.Context, restaurantID, tableID uuid.UUID) error {
	tag, err := r.q(ctx).Exec(ctx, `
		UPDATE tables
		SET deleted_at = NOW(), status = 'INACTIVE', version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, tableID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.New(apperr.CodeNotFound, "table not found")
	}
	return nil
}
func duplicateAreaName(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && strings.Contains(pgErr.ConstraintName, "areas_restaurant_name") {
		return apperr.New(apperr.CodeConflict, "area name already exists")
	}
	return err
}

func (r *Repository) FindArea(ctx context.Context, restaurantID, areaID uuid.UUID) (*domain.Area, error) {
	a := &domain.Area{}
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, restaurant_id, name, COALESCE(description, ''), display_order, is_active
		FROM areas
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, areaID).Scan(&a.ID, &a.RestaurantID, &a.Name, &a.Description, &a.DisplayOrder, &a.IsActive)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "area not found")
	}
	if err != nil {
		return nil, err
	}
	return a, nil
}

func (r *Repository) CreateArea(ctx context.Context, a *domain.Area) error {
	err := r.q(ctx).QueryRow(ctx, `
		INSERT INTO areas (restaurant_id, name, description, display_order, is_active)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, a.RestaurantID, a.Name, a.Description, a.DisplayOrder, a.IsActive).Scan(&a.ID)
	if err != nil {
		return duplicateAreaName(err)
	}
	return nil
}

func (r *Repository) UpdateArea(ctx context.Context, a *domain.Area) error {
	tag, err := r.q(ctx).Exec(ctx, `
		UPDATE areas
		SET name = $3, description = $4, display_order = $5, is_active = $6,
		    version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, a.RestaurantID, a.ID, a.Name, a.Description, a.DisplayOrder, a.IsActive)
	if err != nil {
		return duplicateAreaName(err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.New(apperr.CodeNotFound, "area not found")
	}
	return nil
}

func (r *Repository) DeleteArea(ctx context.Context, restaurantID, areaID uuid.UUID) error {
	tag, err := r.q(ctx).Exec(ctx, `
		UPDATE areas
		SET deleted_at = NOW(), is_active = FALSE, version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, areaID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return apperr.New(apperr.CodeNotFound, "area not found")
	}
	return nil
}

func (r *Repository) ListDailySessions(ctx context.Context, restaurantID uuid.UUID, filter domain.ListDailySessionsFilter) (domain.ListDailySessionsResponse, error) {
	var out domain.ListDailySessionsResponse
	out.Sessions = make([]domain.DailySessionItemDTO, 0)

	var dateFilterStart, dateFilterEnd *time.Time
	if filter.Date != "" {
		if t, err := time.Parse("2006-01-02", filter.Date); err == nil {
			loc := time.Local
			start := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, loc)
			end := start.Add(24 * time.Hour)
			dateFilterStart = &start
			dateFilterEnd = &end
		}
	}

	query := `
		SELECT 
			ds.id,
			COALESCE(ds.session_code, ''),
			ds.table_id,
			t.code AS table_code,
			t.name AS table_name,
			COALESCE(a.name, 'Chưa phân khu') AS area_name,
			ds.status,
			COALESCE(ds.opened_via, 'STAFF'),
			ds.opened_at,
			COALESCE(u_open.full_name, 'Khách quét QR') AS opened_by_name,
			ds.closed_at,
			COALESCE(u_close.full_name, '') AS closed_by_name,
			COALESCE(ds.customer_name, ''),
			COALESCE(inv_stats.total_vnd, 0) AS total_amount_vnd,
			COALESCE(order_stats.item_count, 0) AS total_items_count
		FROM dining_sessions ds
		JOIN tables t ON t.id = ds.table_id
		LEFT JOIN areas a ON a.id = t.area_id
		LEFT JOIN users u_open ON u_open.id = ds.opened_by
		LEFT JOIN users u_close ON u_close.id = ds.closed_by
		LEFT JOIN (
			SELECT dining_session_id, SUM(grand_total_vnd) AS total_vnd
			FROM invoices
			WHERE status = 'PAID' AND deleted_at IS NULL
			GROUP BY dining_session_id
		) inv_stats ON inv_stats.dining_session_id = ds.id
		LEFT JOIN (
			SELECT dining_session_id, SUM(quantity) AS item_count
			FROM order_items
			WHERE status NOT IN ('CANCELLED', 'UNAVAILABLE') AND deleted_at IS NULL
			GROUP BY dining_session_id
		) order_stats ON order_stats.dining_session_id = ds.id
		WHERE ds.restaurant_id = $1
	`
	args := []any{restaurantID}
	idx := 2

	if filter.Status != "" && filter.Status != "ALL" {
		query += fmt.Sprintf(" AND ds.status = $%d", idx)
		args = append(args, filter.Status)
		idx++
	}
	if dateFilterStart != nil && dateFilterEnd != nil {
		query += fmt.Sprintf(" AND ds.opened_at >= $%d AND ds.opened_at < $%d", idx, idx+1)
		args = append(args, *dateFilterStart, *dateFilterEnd)
		idx += 2
	}
	if filter.Search != "" {
		searchTerm := "%" + strings.ToLower(filter.Search) + "%"
		query += fmt.Sprintf(" AND (LOWER(t.code) LIKE $%d OR LOWER(t.name) LIKE $%d OR LOWER(COALESCE(ds.session_code, '')) LIKE $%d)", idx, idx, idx)
		args = append(args, searchTerm)
		idx++
	}

	query += " ORDER BY ds.opened_at DESC"

	rows, err := r.q(ctx).Query(ctx, query, args...)
	if err != nil {
		return out, err
	}
	defer rows.Close()

	for rows.Next() {
		var item domain.DailySessionItemDTO
		var closedAt *time.Time
		err := rows.Scan(
			&item.ID,
			&item.SessionCode,
			&item.TableID,
			&item.TableCode,
			&item.TableName,
			&item.AreaName,
			&item.Status,
			&item.OpenedVia,
			&item.OpenedAt,
			&item.OpenedByName,
			&closedAt,
			&item.ClosedByName,
			&item.CustomerName,
			&item.TotalAmountVND,
			&item.TotalItemsCount,
		)
		if err != nil {
			return out, err
		}
		item.ClosedAt = closedAt

		if closedAt != nil {
			item.DurationMinutes = int(closedAt.Sub(item.OpenedAt).Minutes())
		} else {
			item.DurationMinutes = int(time.Since(item.OpenedAt).Minutes())
		}
		if item.DurationMinutes < 0 {
			item.DurationMinutes = 0
		}

		out.Sessions = append(out.Sessions, item)

		out.Stats.TotalSessions++
		if item.Status == "ACTIVE" || item.Status == "AWAITING_PAYMENT" {
			out.Stats.ActiveSessions++
		} else if item.Status == "CLOSED" {
			out.Stats.ClosedSessions++
		}
		out.Stats.TotalRevenueVND += item.TotalAmountVND
	}

	return out, nil
}

func (r *Repository) GetSessionDetail(ctx context.Context, restaurantID, sessionID uuid.UUID) (domain.SessionDetailDTO, error) {
	var detail domain.SessionDetailDTO
	detail.Orders = make([]domain.SessionOrderDetailDTO, 0)
	detail.Invoices = make([]domain.SessionInvoiceDetailDTO, 0)

	var closedAt *time.Time
	err := r.q(ctx).QueryRow(ctx, `
		SELECT 
			ds.id,
			COALESCE(ds.session_code, ''),
			ds.table_id,
			t.code AS table_code,
			t.name AS table_name,
			COALESCE(a.name, 'Chưa phân khu') AS area_name,
			ds.status,
			COALESCE(ds.opened_via, 'STAFF'),
			ds.opened_at,
			COALESCE(u_open.full_name, 'Khách quét QR') AS opened_by_name,
			ds.closed_at,
			COALESCE(u_close.full_name, '') AS closed_by_name,
			COALESCE(ds.customer_name, ''),
			COALESCE(inv_stats.total_vnd, 0) AS total_amount_vnd,
			COALESCE(order_stats.item_count, 0) AS total_items_count
		FROM dining_sessions ds
		JOIN tables t ON t.id = ds.table_id
		LEFT JOIN areas a ON a.id = t.area_id
		LEFT JOIN users u_open ON u_open.id = ds.opened_by
		LEFT JOIN users u_close ON u_close.id = ds.closed_by
		LEFT JOIN (
			SELECT dining_session_id, SUM(grand_total_vnd) AS total_vnd
			FROM invoices
			WHERE status = 'PAID' AND deleted_at IS NULL
			GROUP BY dining_session_id
		) inv_stats ON inv_stats.dining_session_id = ds.id
		LEFT JOIN (
			SELECT dining_session_id, SUM(quantity) AS item_count
			FROM order_items
			WHERE status NOT IN ('CANCELLED', 'UNAVAILABLE') AND deleted_at IS NULL
			GROUP BY dining_session_id
		) order_stats ON order_stats.dining_session_id = ds.id
		WHERE ds.restaurant_id = $1 AND ds.id = $2
	`, restaurantID, sessionID).Scan(
		&detail.ID,
		&detail.SessionCode,
		&detail.TableID,
		&detail.TableCode,
		&detail.TableName,
		&detail.AreaName,
		&detail.Status,
		&detail.OpenedVia,
		&detail.OpenedAt,
		&detail.OpenedByName,
		&closedAt,
		&detail.ClosedByName,
		&detail.CustomerName,
		&detail.TotalAmountVND,
		&detail.TotalItemsCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return detail, apperr.New(apperr.CodeNotFound, "session not found")
	}
	if err != nil {
		return detail, err
	}
	detail.ClosedAt = closedAt
	if closedAt != nil {
		detail.DurationMinutes = int(closedAt.Sub(detail.OpenedAt).Minutes())
	} else {
		detail.DurationMinutes = int(time.Since(detail.OpenedAt).Minutes())
	}

	orderRows, err := r.q(ctx).Query(ctx, `
		SELECT 
			o.id AS order_id,
			COALESCE(o.order_number, ''),
			o.submitted_at,
			o.status AS order_status,
			oi.id AS order_item_id,
			COALESCE(oi.name_snapshot, mi.name) AS menu_item_name,
			oi.variant_name_snapshot,
			oi.quantity,
			oi.unit_price_vnd,
			oi.options_total_vnd,
			oi.subtotal_vnd,
			oi.status AS item_status,
			COALESCE(oi.station, 'KITCHEN') AS station,
			COALESCE(oi.note, '') AS note
		FROM orders o
		JOIN order_items oi ON oi.order_id = o.id
		LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
		WHERE o.restaurant_id = $1 AND o.dining_session_id = $2 AND o.deleted_at IS NULL
		ORDER BY o.submitted_at ASC, oi.created_at ASC
	`, restaurantID, sessionID)
	if err == nil {
		defer orderRows.Close()
		orderMap := make(map[uuid.UUID]*domain.SessionOrderDetailDTO)
		orderOrder := make([]uuid.UUID, 0)

		for orderRows.Next() {
			var orderID uuid.UUID
			var orderNum string
			var subAt time.Time
			var orderStatus string
			var item domain.SessionOrderItemDetailDTO

			if err := orderRows.Scan(
				&orderID,
				&orderNum,
				&subAt,
				&orderStatus,
				&item.OrderItemID,
				&item.MenuItemName,
				&item.VariantName,
				&item.Quantity,
				&item.UnitPriceVND,
				&item.OptionsTotalVND,
				&item.SubtotalVND,
				&item.Status,
				&item.Station,
				&item.Note,
			); err == nil {
				ord, exists := orderMap[orderID]
				if !exists {
					ord = &domain.SessionOrderDetailDTO{
						OrderID:     orderID,
						OrderNumber: orderNum,
						SubmittedAt: subAt,
						Status:      orderStatus,
						Items:       make([]domain.SessionOrderItemDetailDTO, 0),
					}
					orderMap[orderID] = ord
					orderOrder = append(orderOrder, orderID)
				}
				ord.Items = append(ord.Items, item)
			}
		}
		for _, id := range orderOrder {
			detail.Orders = append(detail.Orders, *orderMap[id])
		}
	}

	invRows, err := r.q(ctx).Query(ctx, `
		SELECT 
			inv.id,
			inv.invoice_number,
			inv.status,
			inv.grand_total_vnd,
			p.payment_method,
			inv.paid_at
		FROM invoices inv
		LEFT JOIN payments p ON p.invoice_id = inv.id
		WHERE inv.restaurant_id = $1 AND inv.dining_session_id = $2 AND inv.deleted_at IS NULL
		ORDER BY inv.created_at DESC
	`, restaurantID, sessionID)
	if err == nil {
		defer invRows.Close()
		for invRows.Next() {
			var inv domain.SessionInvoiceDetailDTO
			var paidAt *time.Time
			var pMethod *string
			if err := invRows.Scan(&inv.ID, &inv.InvoiceNumber, &inv.Status, &inv.GrandTotalVND, &pMethod, &paidAt); err == nil {
				inv.PaidAt = paidAt
				inv.PaymentMethod = pMethod
				detail.Invoices = append(detail.Invoices, inv)
			}
		}
	}

	return detail, nil
}
func (r *Repository) FindListTableTest(ctx context.Context, restaurantID uuid.UUID) ([]domain.ListTableTest, error) {
	var out = make([]domain.ListTableTest, 0)

	row, err := r.q(ctx).Query(ctx, `select id, name from tables`, &restaurantID)

	if err != nil {
		return nil, err
	}

	for row.Next() {
		var o domain.ListTableTest
		if err := row.Scan(&o.TableId, &o.Tablename); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, nil

}
