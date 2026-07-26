package postgres

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"restaurant-management/internal/modules/billing/domain"
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

func (r *Repository) BuildInvoice(ctx context.Context, restaurantID, diningSessionID uuid.UUID) (*domain.Invoice, bool, error) {
	// Bàn đã gộp: hoá đơn treo vào phiên chủ và gom món của cả nhóm
	primaryID, memberIDs, err := r.billingSessions(ctx, restaurantID, diningSessionID)
	if err != nil {
		return nil, false, err
	}

	var sessionID uuid.UUID
	var status string
	var isTakeaway bool
	err = r.q(ctx).QueryRow(ctx, `
		SELECT id, status
		FROM dining_sessions
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`, restaurantID, primaryID).Scan(&sessionID, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		var orderType string
		err = r.q(ctx).QueryRow(ctx, `
			SELECT id, status, order_type
			FROM orders
			WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
			FOR UPDATE
		`, restaurantID, primaryID).Scan(&sessionID, &status, &orderType)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, false, apperr.New(apperr.CodeNotFound, "dining session or order not found")
		}
		if err != nil {
			return nil, false, err
		}
		if orderType != "TAKEAWAY" {
			return nil, false, apperr.New(apperr.CodeInvalid, "not a takeaway order")
		}
		if status == "CANCELLED" {
			return nil, false, apperr.New(apperr.CodeConflict, "order is cancelled")
		}
		isTakeaway = true
	} else if err != nil {
		return nil, false, err
	} else {
		if status == "CLOSED" {
			return nil, false, apperr.New(apperr.CodeConflict, "dining session is closed")
		}
		if status != "ACTIVE" && status != "AWAITING_PAYMENT" {
			return nil, false, apperr.New(apperr.CodeConflict, "dining session is not billable")
		}
	}

	existingIDs, err := r.nonVoidInvoiceIDs(ctx, restaurantID, primaryID)
	if err != nil {
		return nil, false, err
	}
	if len(existingIDs) > 1 {
		return nil, false, apperr.New(apperr.CodeConflict, "session has split invoices")
	}
	if len(existingIDs) == 1 {
		invoice, loadErr := r.LoadInvoice(ctx, restaurantID, existingIDs[0])
		return invoice, false, loadErr
	}

	vatBPS, serviceBPS, err := r.restaurantChargeRates(ctx, restaurantID)
	if err != nil {
		return nil, false, err
	}

	items, subtotal, err := r.billableItems(ctx, restaurantID, memberIDs)
	if err != nil {
		return nil, false, err
	}
	serviceAmount := roundBPS(subtotal, serviceBPS)
	vatAmount := roundBPS(subtotal+serviceAmount, vatBPS)
	total := subtotal + serviceAmount + vatAmount

	invoiceNumber, err := randomCode("INV", 12)
	if err != nil {
		return nil, false, err
	}
	var invoiceID uuid.UUID
	var sessionIDVal any
	var orderIDVal any
	if isTakeaway {
		orderIDVal = primaryID
	} else {
		sessionIDVal = primaryID
	}
	err = r.q(ctx).QueryRow(ctx, `
		INSERT INTO invoices (
			restaurant_id, dining_session_id, order_id, invoice_number, invoice_type, status,
			subtotal_vnd, discount_amount_vnd, discount_reason,
			service_charge_basis_points, service_charge_amount_vnd,
			vat_basis_points, vat_amount_vnd, rounding_amount_vnd, total_amount_vnd
		)
		VALUES ($1, $2, $3, $4, 'STANDARD', 'PENDING', $5, 0, NULL, $6, $7, $8, $9, 0, $10)
		RETURNING id
	`, restaurantID, sessionIDVal, orderIDVal, invoiceNumber, subtotal, serviceBPS, serviceAmount, vatBPS, vatAmount, total).Scan(&invoiceID)
	if pg.IsUniqueViolation(err) {
		return nil, false, apperr.New(apperr.CodeConflict, "invoice number already exists")
	}
	if err != nil {
		return nil, false, err
	}

	for i, item := range items {
		if err := r.insertInvoiceItem(ctx, restaurantID, invoiceID, item, i+1); err != nil {
			return nil, false, err
		}
	}

	if !isTakeaway {
		_, err = r.q(ctx).Exec(ctx, `
			UPDATE dining_sessions
			SET status = 'AWAITING_PAYMENT', version = version + 1, updated_at = NOW()
			WHERE restaurant_id = $1 AND id = ANY($2) AND status = 'ACTIVE' AND deleted_at IS NULL
		`, restaurantID, memberIDs)
		if err != nil {
			return nil, false, err
		}
	}

	invoice, err := r.LoadInvoice(ctx, restaurantID, invoiceID)
	return invoice, true, err
}

func (r *Repository) AdjustInvoice(ctx context.Context, restaurantID, invoiceID uuid.UUID, discountAmountVND int64, discountReason string) (*domain.Invoice, error) {
	var subtotal int64
	var serviceBPS, vatBPS int
	var status string
	err := r.q(ctx).QueryRow(ctx, `
		SELECT status, subtotal_vnd, service_charge_basis_points, vat_basis_points
		FROM invoices
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`, restaurantID, invoiceID).Scan(&status, &subtotal, &serviceBPS, &vatBPS)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "invoice not found")
	}
	if err != nil {
		return nil, err
	}
	if status == "PAID" || status == "VOID" || status == "REFUNDED" || status == "PARTIALLY_PAID" {
		return nil, apperr.New(apperr.CodeConflict, "invoice is not adjustable")
	}
	if discountAmountVND > subtotal {
		discountAmountVND = subtotal
	}
	base := subtotal - discountAmountVND
	serviceAmount := roundBPS(base, serviceBPS)
	vatAmount := roundBPS(base+serviceAmount, vatBPS)
	total := base + serviceAmount + vatAmount
	var reason any
	if discountAmountVND > 0 && strings.TrimSpace(discountReason) != "" {
		reason = discountReason
	}

	_, err = r.q(ctx).Exec(ctx, `
		UPDATE invoices
		SET discount_amount_vnd = $3,
		    discount_reason = $4,
		    service_charge_amount_vnd = $5,
		    vat_amount_vnd = $6,
		    total_amount_vnd = $7,
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, invoiceID, discountAmountVND, reason, serviceAmount, vatAmount, total)
	if err != nil {
		return nil, err
	}
	return r.LoadInvoice(ctx, restaurantID, invoiceID)
}

func (r *Repository) VoidInvoice(ctx context.Context, restaurantID, invoiceID uuid.UUID, reason string) (*domain.Invoice, error) {
	var diningSessionID pgtype.UUID
	err := r.q(ctx).QueryRow(ctx, `
		SELECT dining_session_id
		FROM invoices
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, invoiceID).Scan(&diningSessionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "invoice not found")
	}
	if err != nil {
		return nil, err
	}

	var primaryID uuid.UUID
	var memberIDs []uuid.UUID
	if diningSessionID.Valid {
		sessionID := uuid.UUID(diningSessionID.Bytes)
		primaryID, memberIDs, err = r.billingSessions(ctx, restaurantID, sessionID)
		if err != nil {
			return nil, err
		}
		var lockedSessionID uuid.UUID
		err = r.q(ctx).QueryRow(ctx, `
			SELECT id
			FROM dining_sessions
			WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
			FOR UPDATE
		`, restaurantID, primaryID).Scan(&lockedSessionID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.New(apperr.CodeNotFound, "dining session not found")
		}
		if err != nil {
			return nil, err
		}
	}

	var status string
	err = r.q(ctx).QueryRow(ctx, `
		SELECT status
		FROM invoices
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`, restaurantID, invoiceID).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "invoice not found")
	}
	if err != nil {
		return nil, err
	}
	if status == "PAID" || status == "VOID" || status == "REFUNDED" || status == "PARTIALLY_PAID" {
		return nil, apperr.New(apperr.CodeConflict, "invoice is not voidable")
	}

	_, err = r.q(ctx).Exec(ctx, `
		UPDATE invoices
		SET status = 'VOID',
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, invoiceID)
	if err != nil {
		return nil, err
	}
	if diningSessionID.Valid {
		remainingInvoiceIDs, err := r.nonVoidInvoiceIDs(ctx, restaurantID, primaryID)
		if err != nil {
			return nil, err
		}
		if shouldReopenSessionAfterVoid(len(remainingInvoiceIDs)) {
			if _, err := r.q(ctx).Exec(ctx, `
				UPDATE dining_sessions
				SET status = 'ACTIVE', version = version + 1, updated_at = NOW()
				WHERE restaurant_id = $1
				  AND id = ANY($2)
				  AND status = 'AWAITING_PAYMENT'
				  AND deleted_at IS NULL
			`, restaurantID, memberIDs); err != nil {
				return nil, err
			}
		}
	}
	return r.LoadInvoice(ctx, restaurantID, invoiceID)
}

func (r *Repository) SplitInvoice(ctx context.Context, restaurantID uuid.UUID, input domain.SplitInvoiceInput) ([]*domain.Invoice, error) {
	primaryID, memberIDs, err := r.billingSessions(ctx, restaurantID, input.DiningSessionID)
	if err != nil {
		return nil, err
	}

	var status string
	err = r.q(ctx).QueryRow(ctx, `
		SELECT status
		FROM dining_sessions
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`, restaurantID, primaryID).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "dining session not found")
	}
	if err != nil {
		return nil, err
	}
	if status != "ACTIVE" && status != "AWAITING_PAYMENT" {
		return nil, apperr.New(apperr.CodeConflict, "dining session is not billable")
	}

	items, _, err := r.billableItems(ctx, restaurantID, memberIDs)
	if err != nil {
		return nil, err
	}
	billable := make(map[uuid.UUID]billableItem, len(items))
	for _, item := range items {
		billable[item.OrderItemID] = item
	}
	if err := validateSplitGroups(billable, input.Groups); err != nil {
		return nil, err
	}

	existingRows, err := r.q(ctx).Query(ctx, `
		SELECT id, status
		FROM invoices
		WHERE restaurant_id = $1 AND dining_session_id = $2 AND status <> 'VOID' AND deleted_at IS NULL
		FOR UPDATE
	`, restaurantID, primaryID)
	if err != nil {
		return nil, err
	}
	var existingIDs []uuid.UUID
	for existingRows.Next() {
		var id uuid.UUID
		var invStatus string
		if err := existingRows.Scan(&id, &invStatus); err != nil {
			existingRows.Close()
			return nil, err
		}
		if invStatus != "PENDING" && invStatus != "DRAFT" {
			existingRows.Close()
			return nil, apperr.New(apperr.CodeConflict, "cannot split a session with paid invoices")
		}
		existingIDs = append(existingIDs, id)
	}
	existingRows.Close()
	if err := existingRows.Err(); err != nil {
		return nil, err
	}
	if len(existingIDs) > 0 {
		var processing bool
		if err := r.q(ctx).QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM payments
				WHERE restaurant_id = $1 AND invoice_id = ANY($2) AND status = 'PROCESSING' AND deleted_at IS NULL
			)
		`, restaurantID, existingIDs).Scan(&processing); err != nil {
			return nil, err
		}
		if processing {
			return nil, apperr.New(apperr.CodeConflict, "cannot split a session with paid invoices")
		}
		if _, err := r.q(ctx).Exec(ctx, `
			UPDATE invoices
			SET status = 'VOID', voided_reason = 'SPLIT', voided_at = NOW(), version = version + 1, updated_at = NOW()
			WHERE restaurant_id = $1 AND id = ANY($2)
		`, restaurantID, existingIDs); err != nil {
			return nil, err
		}
	}

	vatBPS, serviceBPS, err := r.restaurantChargeRates(ctx, restaurantID)
	if err != nil {
		return nil, err
	}

	invoices := make([]*domain.Invoice, 0, len(input.Groups))
	for _, group := range input.Groups {
		var subtotal int64
		groupItems := make([]billableItem, 0, len(group.OrderItemIDs))
		for _, id := range group.OrderItemIDs {
			item := billable[id]
			subtotal += item.TotalAmountVND
			groupItems = append(groupItems, item)
		}
		serviceAmount := roundBPS(subtotal, serviceBPS)
		vatAmount := roundBPS(subtotal+serviceAmount, vatBPS)
		total := subtotal + serviceAmount + vatAmount

		invoiceNumber, err := randomCode("INV", 12)
		if err != nil {
			return nil, err
		}
		var invoiceID uuid.UUID
		err = r.q(ctx).QueryRow(ctx, `
			INSERT INTO invoices (
				restaurant_id, dining_session_id, invoice_number, invoice_type, status,
				subtotal_vnd, discount_amount_vnd, discount_reason,
				service_charge_basis_points, service_charge_amount_vnd,
				vat_basis_points, vat_amount_vnd, rounding_amount_vnd, total_amount_vnd
			)
			VALUES ($1, $2, $3, 'STANDARD', 'PENDING', $4, 0, NULL, $5, $6, $7, $8, 0, $9)
			RETURNING id
		`, restaurantID, primaryID, invoiceNumber, subtotal, serviceBPS, serviceAmount, vatBPS, vatAmount, total).Scan(&invoiceID)
		if pg.IsUniqueViolation(err) {
			return nil, apperr.New(apperr.CodeConflict, "invoice number already exists")
		}
		if err != nil {
			return nil, err
		}
		for i, item := range groupItems {
			if err := r.insertInvoiceItem(ctx, restaurantID, invoiceID, item, i+1); err != nil {
				return nil, err
			}
		}
		invoice, err := r.LoadInvoice(ctx, restaurantID, invoiceID)
		if err != nil {
			return nil, err
		}
		invoices = append(invoices, invoice)
	}

	if _, err := r.q(ctx).Exec(ctx, `
		UPDATE dining_sessions
		SET status = 'AWAITING_PAYMENT', version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = ANY($2) AND status = 'ACTIVE' AND deleted_at IS NULL
	`, restaurantID, memberIDs); err != nil {
		return nil, err
	}

	return invoices, nil
}

func (r *Repository) ListSessionInvoices(ctx context.Context, restaurantID, diningSessionID uuid.UUID) ([]*domain.Invoice, error) {
	// Bàn phụ trong nhóm gộp không giữ hoá đơn — trả hoá đơn của phiên chủ
	primaryID, _, err := r.billingSessions(ctx, restaurantID, diningSessionID)
	if err != nil {
		return nil, err
	}
	ids, err := r.nonVoidInvoiceIDs(ctx, restaurantID, primaryID)
	if err != nil {
		return nil, err
	}
	invoices := make([]*domain.Invoice, 0, len(ids))
	for _, id := range ids {
		invoice, err := r.LoadInvoice(ctx, restaurantID, id)
		if err != nil {
			return nil, err
		}
		invoices = append(invoices, invoice)
	}
	return invoices, nil
}

func (r *Repository) GuestSessionStatus(ctx context.Context, restaurantID, diningSessionID uuid.UUID) (string, error) {
	var status string
	err := r.q(ctx).QueryRow(ctx, `
		SELECT status
		FROM dining_sessions
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, diningSessionID).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", apperr.New(apperr.CodeNotFound, "dining session not found")
	}
	return status, err
}

// billingSessions resolves which dining sessions a bill covers. A session in an
// active merge group bills as one: the oldest session of the group owns the
// invoice ("primary") and every member's items go on it. An unmerged session
// bills as itself.
func (r *Repository) billingSessions(ctx context.Context, restaurantID, diningSessionID uuid.UUID) (uuid.UUID, []uuid.UUID, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT ds.id
		FROM dining_sessions ds
		JOIN dining_sessions self ON self.id = $2 AND self.restaurant_id = ds.restaurant_id
		JOIN table_merge_groups g ON g.id = ds.merge_group_id AND g.is_active AND g.deleted_at IS NULL
		WHERE ds.restaurant_id = $1
		  AND ds.merge_group_id = self.merge_group_id
		  AND ds.deleted_at IS NULL
		ORDER BY ds.opened_at, ds.id
	`, restaurantID, diningSessionID)
	if err != nil {
		return uuid.Nil, nil, err
	}
	defer rows.Close()
	var members []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return uuid.Nil, nil, err
		}
		members = append(members, id)
	}
	if err := rows.Err(); err != nil {
		return uuid.Nil, nil, err
	}
	if len(members) == 0 {
		return diningSessionID, []uuid.UUID{diningSessionID}, nil
	}
	return members[0], members, nil
}

// nonVoidInvoiceIDs returns a session's non-VOID invoice ids, oldest first.
func (r *Repository) nonVoidInvoiceIDs(ctx context.Context, restaurantID, diningSessionID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT id
		FROM invoices
		WHERE restaurant_id = $1 AND (dining_session_id = $2 OR order_id = $2) AND status <> 'VOID' AND deleted_at IS NULL
		ORDER BY created_at ASC
	`, restaurantID, diningSessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (r *Repository) restaurantChargeRates(ctx context.Context, restaurantID uuid.UUID) (vatBPS, serviceBPS int, err error) {
	err = r.q(ctx).QueryRow(ctx, `
		SELECT vat_rate_basis_points, service_charge_basis_points
		FROM restaurants
		WHERE id = $1 AND deleted_at IS NULL
	`, restaurantID).Scan(&vatBPS, &serviceBPS)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, 0, apperr.New(apperr.CodeNotFound, "restaurant not found")
	}
	return vatBPS, serviceBPS, err
}

// shouldCloseSession decides whether a session can close after an invoice is
// paid: only once no other invoice for the session is still open (i.e. not
// PAID/VOID) — split invoices must all be settled before the table frees up.
func shouldCloseSession(openNonTerminalInvoices int) bool {
	return openNonTerminalInvoices == 0
}

func shouldReopenSessionAfterVoid(remainingNonVoidInvoices int) bool {
	return remainingNonVoidInvoices == 0
}

// validateSplitGroups checks that groups form an exact partition of the
// session's billable order items: every billable id assigned exactly once,
// no unknown ids, no empty groups, at least 2 groups.
func validateSplitGroups(billable map[uuid.UUID]billableItem, groups []domain.SplitGroupInput) error {
	if len(groups) < 2 {
		return apperr.New(apperr.CodeInvalid, "split requires at least 2 groups")
	}
	seen := make(map[uuid.UUID]bool, len(billable))
	for _, g := range groups {
		if len(g.OrderItemIDs) == 0 {
			return apperr.New(apperr.CodeInvalid, "split group must not be empty")
		}
		for _, id := range g.OrderItemIDs {
			if _, ok := billable[id]; !ok {
				return apperr.New(apperr.CodeInvalid, "order_item_id not billable: "+id.String())
			}
			if seen[id] {
				return apperr.New(apperr.CodeInvalid, "order_item_id assigned to multiple groups: "+id.String())
			}
			seen[id] = true
		}
	}
	if len(seen) != len(billable) {
		return apperr.New(apperr.CodeInvalid, "all billable order items must be assigned to a group")
	}
	return nil
}

func (r *Repository) FindPaymentMethod(ctx context.Context, restaurantID uuid.UUID, code string) (*domain.PaymentMethod, error) {
	method := &domain.PaymentMethod{}
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, code, type, requires_reference
		FROM payment_methods
		WHERE restaurant_id = $1 AND LOWER(code) = $2 AND is_active = TRUE AND deleted_at IS NULL
	`, restaurantID, strings.ToLower(strings.TrimSpace(code))).Scan(&method.ID, &method.Code, &method.Type, &method.RequiresReference)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "payment method not found")
	}
	if err != nil {
		return nil, err
	}
	return method, nil
}

func (r *Repository) ProcessPayment(ctx context.Context, restaurantID uuid.UUID, input domain.PaymentInput) (*domain.Invoice, error) {
	diningSessionID, isTakeaway, totalAmount, err := r.lockPayableInvoice(ctx, restaurantID, input.InvoiceID)
	if err != nil {
		return nil, err
	}
	if input.ReceivedAmountVND < totalAmount {
		return nil, apperr.New(apperr.CodeInvalid, "received_amount_vnd is less than invoice total")
	}
	method, err := r.FindPaymentMethod(ctx, restaurantID, input.PaymentMethodCode)
	if err != nil {
		return nil, err
	}
	if method.RequiresReference && strings.TrimSpace(input.ReferenceCode) == "" {
		return nil, apperr.New(apperr.CodeInvalid, "reference_code is required")
	}
	if err := r.ensureNoPaymentConflict(ctx, restaurantID, input.InvoiceID, uuid.Nil); err != nil {
		return nil, err
	}

	paymentNumber, err := randomCode("PAY", 12)
	if err != nil {
		return nil, err
	}
	change := input.ReceivedAmountVND - totalAmount
	var reference any
	if strings.TrimSpace(input.ReferenceCode) != "" {
		reference = strings.TrimSpace(input.ReferenceCode)
	}
	var paymentID uuid.UUID
	var sessionIDVal any
	var orderIDVal any
	if isTakeaway {
		orderIDVal = diningSessionID
	} else {
		sessionIDVal = diningSessionID
	}
	err = r.q(ctx).QueryRow(ctx, `
		INSERT INTO payments (
			restaurant_id, invoice_id, dining_session_id, order_id, payment_number, payment_method_id,
			amount_vnd, status, reference_code, received_amount_vnd, change_amount_vnd,
			processed_at, processed_by
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'COMPLETED', $8, $9, $10, NOW(), $11)
		RETURNING id
	`, restaurantID, input.InvoiceID, sessionIDVal, orderIDVal, paymentNumber, method.ID, totalAmount, reference, input.ReceivedAmountVND, change, input.ProcessedBy).Scan(&paymentID)
	if pg.IsUniqueViolation(err) {
		return nil, apperr.New(apperr.CodeConflict, "payment number already exists")
	}
	if err != nil {
		return nil, err
	}

	_, err = r.q(ctx).Exec(ctx, `
		UPDATE invoices
		SET status = 'PAID',
		    paid_amount_vnd = $3,
		    change_amount_vnd = $4,
		    issued_at = COALESCE(issued_at, NOW()),
		    issued_by = COALESCE(issued_by, $5),
		    paid_at = NOW(),
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, input.InvoiceID, totalAmount, change, input.ProcessedBy)
	if err != nil {
		return nil, err
	}
	if err := r.closeSessionAndFreeTable(ctx, restaurantID, diningSessionID, input.ProcessedBy); err != nil {
		return nil, err
	}
	_ = paymentID
	return r.LoadInvoice(ctx, restaurantID, input.InvoiceID)
}

func (r *Repository) ProcessPartialPayment(ctx context.Context, restaurantID uuid.UUID, input domain.PartialPaymentInput) (*domain.Invoice, error) {
	diningSessionID, isTakeaway, totalAmount, err := r.lockPayableInvoice(ctx, restaurantID, input.InvoiceID)
	if err != nil {
		return nil, err
	}

	method, err := r.FindPaymentMethod(ctx, restaurantID, input.PaymentMethodCode)
	if err != nil {
		return nil, err
	}
	if method.Type == "E_WALLET" {
		return nil, apperr.New(apperr.CodeInvalid, "partial payment with e-wallet is not supported")
	}
	if method.RequiresReference && strings.TrimSpace(input.ReferenceCode) == "" {
		return nil, apperr.New(apperr.CodeInvalid, "reference_code is required")
	}

	// Completed payments are expected here: each partial payment is stored as a
	// separate COMPLETED row and contributes to the invoice's running total.
	// Only an in-flight asynchronous payment conflicts with a new partial payment.
	if err := r.ensureNoProcessingPaymentConflict(ctx, restaurantID, input.InvoiceID, uuid.Nil); err != nil {
		return nil, err
	}

	var existingPaid int64
	if err := r.q(ctx).QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_vnd), 0)
		FROM payments
		WHERE restaurant_id = $1 AND invoice_id = $2 AND status = 'COMPLETED' AND deleted_at IS NULL
	`, restaurantID, input.InvoiceID).Scan(&existingPaid); err != nil {
		return nil, err
	}

	split, err := calculatePartialPayment(existingPaid, input.ReceivedAmountVND, totalAmount, method.Type == "CASH")
	if err != nil {
		return nil, err
	}
	newRunningTotal, newStatus, change := split.RunningPaid, split.Status, split.Change

	paymentNumber, err := randomCode("PAY", 12)
	if err != nil {
		return nil, err
	}
	var reference any
	if strings.TrimSpace(input.ReferenceCode) != "" {
		reference = strings.TrimSpace(input.ReferenceCode)
	}
	var paymentID uuid.UUID
	var sessionIDVal any
	var orderIDVal any
	if isTakeaway {
		orderIDVal = diningSessionID
	} else {
		sessionIDVal = diningSessionID
	}
	err = r.q(ctx).QueryRow(ctx, `
		INSERT INTO payments (
			restaurant_id, invoice_id, dining_session_id, order_id, payment_number, payment_method_id,
			amount_vnd, status, reference_code, received_amount_vnd, change_amount_vnd,
			processed_at, processed_by
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'COMPLETED', $8, $9, $10, NOW(), $11)
		RETURNING id
	`, restaurantID, input.InvoiceID, sessionIDVal, orderIDVal, paymentNumber, method.ID, split.Applied, reference, input.ReceivedAmountVND, change, input.ProcessedBy).Scan(&paymentID)
	if pg.IsUniqueViolation(err) {
		return nil, apperr.New(apperr.CodeConflict, "payment number already exists")
	}
	if err != nil {
		return nil, err
	}

	_, err = r.q(ctx).Exec(ctx, `
		UPDATE invoices
		SET status = $3,
		    paid_amount_vnd = $4,
		    change_amount_vnd = $5,
		    issued_at = COALESCE(issued_at, NOW()),
		    issued_by = COALESCE(issued_by, $6),
		    paid_at = CASE WHEN $3 = 'PAID' THEN NOW() ELSE paid_at END,
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, input.InvoiceID, newStatus, newRunningTotal, change, input.ProcessedBy)
	if err != nil {
		return nil, err
	}

	if newStatus == "PAID" {
		if err := r.closeSessionAndFreeTable(ctx, restaurantID, diningSessionID, input.ProcessedBy); err != nil {
			return nil, err
		}
	}

	_ = paymentID
	return r.LoadInvoice(ctx, restaurantID, input.InvoiceID)
}

// partialPaymentSplit tách số tiền khách đưa thành phần ghi vào hóa đơn và tiền thừa.
type partialPaymentSplit struct {
	Applied     int64  // ghi vào payments.amount_vnd
	Change      int64  // tiền thối lại
	RunningPaid int64  // tổng đã trả sau lần này
	Status      string // trạng thái mới của hóa đơn
}

// allowChange: chỉ tiền mặt mới thối lại được. Thẻ/chuyển khoản đưa dư phải
// hoàn qua ngân hàng nên vẫn từ chối tại đây.
func calculatePartialPayment(existingPaid, receivedAmount, totalAmount int64, allowChange bool) (partialPaymentSplit, error) {
	var out partialPaymentSplit
	if receivedAmount <= 0 {
		return out, apperr.New(apperr.CodeInvalid, "received_amount_vnd must be positive")
	}
	if existingPaid < 0 || existingPaid >= totalAmount {
		return out, apperr.New(apperr.CodeInvalid, "total payment exceeds invoice amount")
	}

	remaining := totalAmount - existingPaid
	applied := receivedAmount
	if applied > remaining {
		if !allowChange {
			return out, apperr.New(apperr.CodeInvalid, "total payment exceeds invoice amount")
		}
		applied = remaining
	}

	out.Applied = applied
	out.Change = receivedAmount - applied
	out.RunningPaid = existingPaid + applied
	out.Status = "PARTIALLY_PAID"
	if out.RunningPaid == totalAmount {
		out.Status = "PAID"
	}
	return out, nil
}

func (r *Repository) PrepareAsyncPayment(ctx context.Context, restaurantID uuid.UUID, input domain.AsyncPaymentInput) (*domain.AsyncPaymentPreparation, error) {
	diningSessionID, isTakeaway, totalAmount, err := r.lockPayableInvoice(ctx, restaurantID, input.InvoiceID)
	if err != nil {
		return nil, err
	}
	method, err := r.FindPaymentMethod(ctx, restaurantID, input.PaymentMethodCode)
	if err != nil {
		return nil, err
	}
	if existing, err := r.findProcessingPayment(ctx, restaurantID, input.InvoiceID, method.ID); err != nil {
		return nil, err
	} else if existing != nil {
		invoice, err := r.LoadInvoice(ctx, restaurantID, input.InvoiceID)
		return &domain.AsyncPaymentPreparation{Invoice: invoice, Payment: existing, Created: false}, err
	}
	if err := r.ensureNoPaymentConflict(ctx, restaurantID, input.InvoiceID, method.ID); err != nil {
		return nil, err
	}

	paymentNumber, err := randomPaymentCode()
	if err != nil {
		return nil, err
	}
	var paymentID uuid.UUID
	var sessionIDVal any
	var orderIDVal any
	if isTakeaway {
		orderIDVal = diningSessionID
	} else {
		sessionIDVal = diningSessionID
	}
	err = r.q(ctx).QueryRow(ctx, `
		INSERT INTO payments (
			restaurant_id, invoice_id, dining_session_id, order_id, payment_number, payment_method_id,
			amount_vnd, status, received_amount_vnd, change_amount_vnd, processed_by
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'PROCESSING', NULL, 0, $8)
		RETURNING id
	`, restaurantID, input.InvoiceID, sessionIDVal, orderIDVal, paymentNumber, method.ID, totalAmount, input.ProcessedBy).Scan(&paymentID)
	if pg.IsUniqueViolation(err) {
		return nil, apperr.New(apperr.CodeConflict, "payment number already exists")
	}
	if err != nil {
		return nil, err
	}
	invoice, err := r.LoadInvoice(ctx, restaurantID, input.InvoiceID)
	if err != nil {
		return nil, err
	}
	return &domain.AsyncPaymentPreparation{Invoice: invoice, Payment: invoice.Payment, Created: true}, nil
}

func (r *Repository) AttachGatewayResult(ctx context.Context, restaurantID, paymentID uuid.UUID, result domain.InitiateResult) (*domain.Invoice, error) {
	raw := result.Raw
	if raw == nil {
		raw = map[string]any{}
	}
	if result.PayURL != "" {
		raw["pay_url"] = result.PayURL
	}
	if result.Deeplink != "" {
		raw["deeplink"] = result.Deeplink
	}
	if result.QRCodeURL != "" {
		raw["qr_code_url"] = result.QRCodeURL
	}
	payload, err := json.Marshal(raw)
	if err != nil {
		return nil, err
	}
	var invoiceID uuid.UUID
	err = r.q(ctx).QueryRow(ctx, `
		UPDATE payments
		SET gateway_transaction_id = $3,
		    transaction_data = $4,
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND status = 'PROCESSING' AND deleted_at IS NULL
		RETURNING invoice_id
	`, restaurantID, paymentID, result.GatewayTransactionID, payload).Scan(&invoiceID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "processing payment not found")
	}
	if err != nil {
		return nil, err
	}
	return r.LoadInvoice(ctx, restaurantID, invoiceID)
}

func (r *Repository) FindWebhookPayment(ctx context.Context, gatewayTransactionID, orderRef string) (*domain.WebhookPayment, error) {
	payment := &domain.WebhookPayment{}
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, restaurant_id, invoice_id, dining_session_id, payment_number, amount_vnd, status
		FROM payments
		WHERE deleted_at IS NULL
		  AND (($1 <> '' AND gateway_transaction_id = $1) OR ($2 <> '' AND payment_number = $2))
		ORDER BY created_at DESC
		LIMIT 1
	`, strings.TrimSpace(gatewayTransactionID), strings.TrimSpace(orderRef)).Scan(&payment.ID, &payment.RestaurantID, &payment.InvoiceID, &payment.DiningSessionID, &payment.PaymentNumber, &payment.AmountVND, &payment.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return payment, nil
}

func (r *Repository) InsertWebhookEvent(ctx context.Context, restaurantID uuid.UUID, provider, eventID string, paymentID uuid.UUID, payload any) (uuid.UUID, bool, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return uuid.Nil, false, err
	}
	var id uuid.UUID
	err = r.q(ctx).QueryRow(ctx, `
		INSERT INTO payment_webhook_events (restaurant_id, provider, event_id, payment_id, payload)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, restaurantID, provider, eventID, paymentID, data).Scan(&id)
	if pg.IsUniqueViolation(err) {
		return uuid.Nil, false, nil
	}
	if err != nil {
		return uuid.Nil, false, err
	}
	return id, true, nil
}

func (r *Repository) CompleteWebhookPayment(ctx context.Context, restaurantID, paymentID uuid.UUID, event domain.WebhookEvent) (*domain.Invoice, error) {
	payment, err := r.lockPayment(ctx, restaurantID, paymentID)
	if err != nil {
		return nil, err
	}
	if payment.Status == domain.PaymentCompleted || payment.Status == domain.PaymentFailed {
		return r.LoadInvoice(ctx, restaurantID, payment.InvoiceID)
	}
	payload, err := json.Marshal(event.Raw)
	if err != nil {
		return nil, err
	}
	_, err = r.q(ctx).Exec(ctx, `
		UPDATE payments
		SET status = 'COMPLETED',
		    received_amount_vnd = amount_vnd,
		    change_amount_vnd = 0,
		    processed_at = NOW(),
		    gateway_transaction_id = COALESCE(NULLIF($3, ''), gateway_transaction_id),
		    transaction_data = COALESCE(transaction_data, '{}'::jsonb) || $4::jsonb,
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, paymentID, event.GatewayTransactionID, payload)
	if err != nil {
		return nil, err
	}
	_, err = r.q(ctx).Exec(ctx, `
		UPDATE invoices
		SET status = 'PAID',
		    paid_amount_vnd = total_amount_vnd,
		    change_amount_vnd = 0,
		    issued_at = COALESCE(issued_at, NOW()),
		    paid_at = NOW(),
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, payment.InvoiceID)
	if err != nil {
		return nil, err
	}
	if err := r.closeSessionAndFreeTable(ctx, restaurantID, payment.DiningSessionID, uuid.Nil); err != nil {
		return nil, err
	}
	return r.LoadInvoice(ctx, restaurantID, payment.InvoiceID)
}

func (r *Repository) FailWebhookPayment(ctx context.Context, restaurantID, paymentID uuid.UUID, event domain.WebhookEvent) (*domain.Invoice, error) {
	payment, err := r.lockPayment(ctx, restaurantID, paymentID)
	if err != nil {
		return nil, err
	}
	if payment.Status == domain.PaymentCompleted || payment.Status == domain.PaymentFailed {
		return r.LoadInvoice(ctx, restaurantID, payment.InvoiceID)
	}
	payload, err := json.Marshal(event.Raw)
	if err != nil {
		return nil, err
	}
	_, err = r.q(ctx).Exec(ctx, `
		UPDATE payments
		SET status = 'FAILED',
		    processed_at = NOW(),
		    transaction_data = COALESCE(transaction_data, '{}'::jsonb) || $3::jsonb,
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, paymentID, payload)
	if err != nil {
		return nil, err
	}
	return r.LoadInvoice(ctx, restaurantID, payment.InvoiceID)
}

func (r *Repository) MarkWebhookProcessed(ctx context.Context, eventRowID uuid.UUID) error {
	_, err := r.q(ctx).Exec(ctx, `UPDATE payment_webhook_events SET processed_at = NOW() WHERE id = $1`, eventRowID)
	return err
}

func (r *Repository) MarkWebhookError(ctx context.Context, eventRowID uuid.UUID, message string) error {
	_, err := r.q(ctx).Exec(ctx, `UPDATE payment_webhook_events SET processing_error = $2 WHERE id = $1`, eventRowID, message)
	return err
}

func (r *Repository) LoadInvoice(ctx context.Context, restaurantID, invoiceID uuid.UUID) (*domain.Invoice, error) {
	inv := &domain.Invoice{Items: []domain.InvoiceItem{}}
	var reason pgtype.Text
	var issuedAt, paidAt pgtype.Timestamptz
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, restaurant_id, COALESCE(dining_session_id, order_id), invoice_number, status,
		       subtotal_vnd, discount_amount_vnd, discount_reason,
		       service_charge_basis_points, service_charge_amount_vnd,
		       vat_basis_points, vat_amount_vnd, rounding_amount_vnd, total_amount_vnd,
		       paid_amount_vnd, change_amount_vnd, issued_at, paid_at, version
		FROM invoices
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, invoiceID).Scan(
		&inv.ID, &inv.RestaurantID, &inv.DiningSessionID, &inv.InvoiceNumber, &inv.Status,
		&inv.SubtotalVND, &inv.DiscountAmountVND, &reason,
		&inv.ServiceChargeBasisPoints, &inv.ServiceChargeAmountVND,
		&inv.VATBasisPoints, &inv.VATAmountVND, &inv.RoundingAmountVND, &inv.TotalAmountVND,
		&inv.PaidAmountVND, &inv.ChangeAmountVND, &issuedAt, &paidAt, &inv.Version,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "invoice not found")
	}
	if err != nil {
		return nil, err
	}
	if reason.Valid {
		s := reason.String
		inv.DiscountReason = &s
	}
	if issuedAt.Valid {
		t := issuedAt.Time
		inv.IssuedAt = &t
	}
	if paidAt.Valid {
		t := paidAt.Time
		inv.PaidAt = &t
	}
	items, err := r.loadInvoiceItems(ctx, restaurantID, invoiceID)
	if err != nil {
		return nil, err
	}
	inv.Items = items
	payment, err := r.loadLatestPayment(ctx, restaurantID, invoiceID)
	if err != nil {
		return nil, err
	}
	inv.Payment = payment
	allPayments, err := r.loadInvoicePayments(ctx, restaurantID, invoiceID)
	if err != nil {
		return nil, err
	}
	inv.Payments = allPayments
	return inv, nil
}

func (r *Repository) lockPayableInvoice(ctx context.Context, restaurantID, invoiceID uuid.UUID) (uuid.UUID, bool, int64, error) {
	var diningSessionID, orderID pgtype.UUID
	var invoiceStatus string
	var totalAmount int64
	err := r.q(ctx).QueryRow(ctx, `
		SELECT dining_session_id, order_id, status, total_amount_vnd
		FROM invoices
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`, restaurantID, invoiceID).Scan(&diningSessionID, &orderID, &invoiceStatus, &totalAmount)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, false, 0, apperr.New(apperr.CodeNotFound, "invoice not found")
	}
	if err != nil {
		return uuid.Nil, false, 0, err
	}
	if invoiceStatus == "PAID" {
		return uuid.Nil, false, 0, apperr.New(apperr.CodeConflict, "invoice already paid")
	}
	if invoiceStatus == "VOID" || invoiceStatus == "REFUNDED" {
		return uuid.Nil, false, 0, apperr.New(apperr.CodeConflict, "invoice is not payable")
	}
	var id uuid.UUID
	var isTakeaway bool
	if orderID.Valid {
		id = uuid.UUID(orderID.Bytes)
		isTakeaway = true
	} else if diningSessionID.Valid {
		id = uuid.UUID(diningSessionID.Bytes)
	} else {
		return uuid.Nil, false, 0, apperr.New(apperr.CodeInternal, "invoice has no linked session or order")
	}
	return id, isTakeaway, totalAmount, nil
}

func (r *Repository) ensureNoPaymentConflict(ctx context.Context, restaurantID, invoiceID, allowedProcessingMethodID uuid.UUID) error {
	var completed bool
	if err := r.q(ctx).QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM payments WHERE restaurant_id = $1 AND invoice_id = $2 AND status = 'COMPLETED' AND deleted_at IS NULL)
	`, restaurantID, invoiceID).Scan(&completed); err != nil {
		return err
	}
	if completed {
		return apperr.New(apperr.CodeConflict, "invoice already has a completed payment")
	}
	return r.ensureNoProcessingPaymentConflict(ctx, restaurantID, invoiceID, allowedProcessingMethodID)
}

func (r *Repository) ensureNoProcessingPaymentConflict(ctx context.Context, restaurantID, invoiceID, allowedProcessingMethodID uuid.UUID) error {
	var processing bool
	args := []any{restaurantID, invoiceID}
	query := `SELECT EXISTS (SELECT 1 FROM payments WHERE restaurant_id = $1 AND invoice_id = $2 AND status = 'PROCESSING' AND deleted_at IS NULL`
	if allowedProcessingMethodID != uuid.Nil {
		query += ` AND payment_method_id <> $3`
		args = append(args, allowedProcessingMethodID)
	}
	query += `)`
	if err := r.q(ctx).QueryRow(ctx, query, args...).Scan(&processing); err != nil {
		return err
	}
	if processing {
		return apperr.New(apperr.CodeConflict, "invoice has a processing payment")
	}
	return nil
}

func (r *Repository) findProcessingPayment(ctx context.Context, restaurantID, invoiceID, methodID uuid.UUID) (*domain.Payment, error) {
	payment := &domain.Payment{}
	var ref, gatewayID pgtype.Text
	var processed pgtype.Timestamptz
	var raw []byte
	err := r.q(ctx).QueryRow(ctx, `
		SELECT p.id, p.invoice_id, p.dining_session_id, p.payment_number,
		       pm.code, pm.type, p.amount_vnd, COALESCE(p.received_amount_vnd, 0), p.change_amount_vnd,
		       p.status, p.reference_code, p.gateway_transaction_id, COALESCE(p.transaction_data, '{}'::jsonb), p.processed_at
		FROM payments p
		JOIN payment_methods pm ON pm.restaurant_id = p.restaurant_id AND pm.id = p.payment_method_id
		WHERE p.restaurant_id = $1 AND p.invoice_id = $2 AND p.payment_method_id = $3 AND p.status = 'PROCESSING' AND p.deleted_at IS NULL
		ORDER BY p.created_at DESC
		LIMIT 1
	`, restaurantID, invoiceID, methodID).Scan(
		&payment.ID, &payment.InvoiceID, &payment.DiningSessionID, &payment.PaymentNumber,
		&payment.MethodCode, &payment.MethodType, &payment.AmountVND, &payment.ReceivedAmountVND, &payment.ChangeAmountVND,
		&payment.Status, &ref, &gatewayID, &raw, &processed,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	applyPaymentNulls(payment, ref, gatewayID, raw, processed)
	return payment, nil
}

func (r *Repository) lockPayment(ctx context.Context, restaurantID, paymentID uuid.UUID) (*domain.WebhookPayment, error) {
	payment := &domain.WebhookPayment{}
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, restaurant_id, invoice_id, dining_session_id, payment_number, amount_vnd, status
		FROM payments
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`, restaurantID, paymentID).Scan(&payment.ID, &payment.RestaurantID, &payment.InvoiceID, &payment.DiningSessionID, &payment.PaymentNumber, &payment.AmountVND, &payment.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "payment not found")
	}
	if err != nil {
		return nil, err
	}
	return payment, nil
}

func (r *Repository) closeSessionAndFreeTable(ctx context.Context, restaurantID, diningSessionID, actorID uuid.UUID) error {
	var openInvoices int
	if err := r.q(ctx).QueryRow(ctx, `
		SELECT COUNT(*) FROM invoices
		WHERE restaurant_id = $1 AND (dining_session_id = $2 OR order_id = $2)
		  AND status NOT IN ('PAID', 'VOID') AND deleted_at IS NULL
	`, restaurantID, diningSessionID).Scan(&openInvoices); err != nil {
		return err
	}
	if !shouldCloseSession(openInvoices) {
		return nil
	}

	var tableID pgtype.UUID
	err := r.q(ctx).QueryRow(ctx, `
		SELECT table_id
		FROM dining_sessions
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`, restaurantID, diningSessionID).Scan(&tableID)
	if errors.Is(err, pgx.ErrNoRows) {
		// Might be a Takeaway order
		var orderType string
		err = r.q(ctx).QueryRow(ctx, `
			SELECT order_type FROM orders
			WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		`, restaurantID, diningSessionID).Scan(&orderType)
		if errors.Is(err, pgx.ErrNoRows) {
			return apperr.New(apperr.CodeNotFound, "dining session or order not found")
		}
		if err != nil {
			return err
		}
		if orderType == "TAKEAWAY" {
			_, err = r.q(ctx).Exec(ctx, `
				UPDATE orders SET status = 'PAID', updated_at = NOW()
				WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
			`, restaurantID, diningSessionID)
			return err
		}
		return apperr.New(apperr.CodeInvalid, "not a valid session or takeaway order")
	}
	if err != nil {
		return err
	}
	var actor any
	if actorID != uuid.Nil {
		actor = actorID
	}
	if _, err := r.q(ctx).Exec(ctx, `
		UPDATE dining_sessions
		SET status = 'CLOSED', closed_at = COALESCE(closed_at, NOW()), closed_by = COALESCE(closed_by, $3), version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, diningSessionID, actor); err != nil {
		return err
	}
	if tableID.Valid {
		if _, err := r.q(ctx).Exec(ctx, `
			UPDATE tables
			SET status = 'AVAILABLE', version = version + 1, updated_at = NOW()
			WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		`, restaurantID, tableID.Bytes); err != nil {
			return err
		}
	}
	return nil
}

type billableItem struct {
	OrderItemID       uuid.UUID
	NameSnapshot      string
	UnitPriceVND      int64
	Quantity          int
	SubtotalVND       int64
	DiscountAmountVND int64
	TotalAmountVND    int64
}

func (r *Repository) billableItems(ctx context.Context, restaurantID uuid.UUID, diningSessionIDs []uuid.UUID) ([]billableItem, int64, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT oi.id, oi.item_name_snapshot, oi.unit_price_vnd, oi.quantity,
		       oi.subtotal_vnd, oi.discount_amount_vnd, oi.total_amount_vnd
		FROM order_items oi
		JOIN orders o ON o.restaurant_id = oi.restaurant_id AND o.id = oi.order_id
		WHERE oi.restaurant_id = $1
		  AND (oi.dining_session_id = ANY($2) OR oi.order_id = ANY($2))
		  AND oi.deleted_at IS NULL
		  AND oi.status <> 'CANCELLED'
		  AND o.deleted_at IS NULL
		  AND o.status <> 'CANCELLED'
		ORDER BY o.submitted_at, oi.created_at, oi.id
	`, restaurantID, diningSessionIDs)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := []billableItem{}
	var subtotal int64
	for rows.Next() {
		var item billableItem
		if err := rows.Scan(&item.OrderItemID, &item.NameSnapshot, &item.UnitPriceVND, &item.Quantity, &item.SubtotalVND, &item.DiscountAmountVND, &item.TotalAmountVND); err != nil {
			return nil, 0, err
		}
		subtotal += item.TotalAmountVND
		items = append(items, item)
	}
	return items, subtotal, rows.Err()
}

func (r *Repository) insertInvoiceItem(ctx context.Context, restaurantID, invoiceID uuid.UUID, item billableItem, displayOrder int) error {
	_, err := r.q(ctx).Exec(ctx, `
		INSERT INTO invoice_items (
			restaurant_id, invoice_id, order_item_id, item_type, name_snapshot,
			unit_price_vnd, quantity, subtotal_vnd, discount_amount_vnd, total_amount_vnd, display_order
		)
		VALUES ($1, $2, $3, 'MENU_ITEM', $4, $5, $6, $7, $8, $9, $10)
	`, restaurantID, invoiceID, item.OrderItemID, item.NameSnapshot, item.UnitPriceVND, item.Quantity, item.SubtotalVND, item.DiscountAmountVND, item.TotalAmountVND, displayOrder)
	return err
}

func (r *Repository) loadInvoiceItems(ctx context.Context, restaurantID, invoiceID uuid.UUID) ([]domain.InvoiceItem, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT id, invoice_id, order_item_id, name_snapshot, unit_price_vnd, quantity,
		       subtotal_vnd, discount_amount_vnd, total_amount_vnd
		FROM invoice_items
		WHERE restaurant_id = $1 AND invoice_id = $2
		ORDER BY display_order, created_at, id
	`, restaurantID, invoiceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []domain.InvoiceItem{}
	for rows.Next() {
		var item domain.InvoiceItem
		var orderItemID pgtype.UUID
		if err := rows.Scan(&item.ID, &item.InvoiceID, &orderItemID, &item.NameSnapshot, &item.UnitPriceVND, &item.Quantity, &item.SubtotalVND, &item.DiscountAmountVND, &item.TotalAmountVND); err != nil {
			return nil, err
		}
		if orderItemID.Valid {
			id := uuid.UUID(orderItemID.Bytes)
			item.OrderItemID = &id
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) loadLatestPayment(ctx context.Context, restaurantID, invoiceID uuid.UUID) (*domain.Payment, error) {
	payment := &domain.Payment{}
	var ref, gatewayID pgtype.Text
	var processed pgtype.Timestamptz
	var raw []byte
	err := r.q(ctx).QueryRow(ctx, `
		SELECT p.id, p.invoice_id, p.dining_session_id, p.payment_number,
		       pm.code, pm.type, p.amount_vnd, COALESCE(p.received_amount_vnd, 0), p.change_amount_vnd,
		       p.status, p.reference_code, p.gateway_transaction_id, COALESCE(p.transaction_data, '{}'::jsonb), p.processed_at
		FROM payments p
		JOIN payment_methods pm ON pm.restaurant_id = p.restaurant_id AND pm.id = p.payment_method_id
		WHERE p.restaurant_id = $1 AND p.invoice_id = $2 AND p.status IN ('PROCESSING', 'COMPLETED', 'FAILED') AND p.deleted_at IS NULL
		ORDER BY CASE p.status WHEN 'PROCESSING' THEN 0 WHEN 'COMPLETED' THEN 1 ELSE 2 END, p.created_at DESC
		LIMIT 1
	`, restaurantID, invoiceID).Scan(
		&payment.ID, &payment.InvoiceID, &payment.DiningSessionID, &payment.PaymentNumber,
		&payment.MethodCode, &payment.MethodType, &payment.AmountVND, &payment.ReceivedAmountVND, &payment.ChangeAmountVND,
		&payment.Status, &ref, &gatewayID, &raw, &processed,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	applyPaymentNulls(payment, ref, gatewayID, raw, processed)
	return payment, nil
}

func (r *Repository) loadInvoicePayments(ctx context.Context, restaurantID, invoiceID uuid.UUID) ([]domain.Payment, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT p.id, p.invoice_id, p.dining_session_id, p.payment_number,
		       pm.code, pm.type, p.amount_vnd, COALESCE(p.received_amount_vnd, 0), p.change_amount_vnd,
		       p.status, p.reference_code, p.gateway_transaction_id, COALESCE(p.transaction_data, '{}'::jsonb), p.processed_at
		FROM payments p
		JOIN payment_methods pm ON pm.restaurant_id = p.restaurant_id AND pm.id = p.payment_method_id
		WHERE p.restaurant_id = $1 AND p.invoice_id = $2 AND p.deleted_at IS NULL
		ORDER BY p.created_at ASC
	`, restaurantID, invoiceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var payments []domain.Payment
	for rows.Next() {
		var payment domain.Payment
		var ref, gatewayID pgtype.Text
		var processed pgtype.Timestamptz
		var raw []byte
		if err := rows.Scan(
			&payment.ID, &payment.InvoiceID, &payment.DiningSessionID, &payment.PaymentNumber,
			&payment.MethodCode, &payment.MethodType, &payment.AmountVND, &payment.ReceivedAmountVND, &payment.ChangeAmountVND,
			&payment.Status, &ref, &gatewayID, &raw, &processed,
		); err != nil {
			return nil, err
		}
		applyPaymentNulls(&payment, ref, gatewayID, raw, processed)
		payments = append(payments, payment)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if payments == nil {
		return []domain.Payment{}, nil
	}
	return payments, nil
}

func applyPaymentNulls(payment *domain.Payment, ref, gatewayID pgtype.Text, raw []byte, processed pgtype.Timestamptz) {
	if ref.Valid {
		s := ref.String
		payment.ReferenceCode = &s
	}
	if gatewayID.Valid {
		s := gatewayID.String
		payment.GatewayTransactionID = &s
	}
	if processed.Valid {
		t := processed.Time
		payment.ProcessedAt = &t
	}
	if len(raw) > 0 {
		var data map[string]any
		if err := json.Unmarshal(raw, &data); err == nil {
			if v, _ := data["pay_url"].(string); v != "" {
				payment.PayURL = v
			}
			if v, _ := data["deeplink"].(string); v != "" {
				payment.Deeplink = v
			}
			if v, _ := data["qr_code_url"].(string); v != "" {
				payment.QRCodeURL = v
			}
		}
	}
}

func roundBPS(amount int64, bps int) int64 {
	if amount <= 0 || bps <= 0 {
		return 0
	}
	return (amount*int64(bps) + 5000) / 10000
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func randomCode(prefix string, n int) (string, error) {
	token, err := randomToken(n)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s-%s", prefix, token), nil
}

func randomPaymentCode() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "PAY" + strings.ToUpper(hex.EncodeToString(b)), nil
}
