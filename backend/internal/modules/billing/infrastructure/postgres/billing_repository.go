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
		SELECT id, status, discount_amount_vnd,
		       service_charge_basis_points, vat_basis_points
		FROM invoices
		WHERE restaurant_id = $1 AND dining_session_id = $2 AND status <> 'VOID' AND deleted_at IS NULL
		FOR UPDATE
	`, restaurantID, primaryID)
	if err != nil {
		return nil, err
	}
	var existingIDs []uuid.UUID
	var serviceBPS, vatBPS int
	hasChargeSnapshot := false
	for existingRows.Next() {
		var id uuid.UUID
		var invStatus string
		var discountAmountVND int64
		var invoiceServiceBPS, invoiceVATBPS int
		if err := existingRows.Scan(
			&id,
			&invStatus,
			&discountAmountVND,
			&invoiceServiceBPS,
			&invoiceVATBPS,
		); err != nil {
			existingRows.Close()
			return nil, err
		}
		if invStatus != "PENDING" && invStatus != "DRAFT" {
			existingRows.Close()
			return nil, apperr.New(apperr.CodeConflict, "cannot split a session with paid invoices")
		}
		if discountAmountVND > 0 {
			existingRows.Close()
			return nil, apperr.New(apperr.CodeConflict, "remove invoice discount before splitting")
		}
		if !hasChargeSnapshot {
			serviceBPS = invoiceServiceBPS
			vatBPS = invoiceVATBPS
			hasChargeSnapshot = true
		} else if serviceBPS != invoiceServiceBPS || vatBPS != invoiceVATBPS {
			existingRows.Close()
			return nil, apperr.New(apperr.CodeConflict, "invoice charge rates are inconsistent")
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

	if !hasChargeSnapshot {
		vatBPS, serviceBPS, err = r.restaurantChargeRates(ctx, restaurantID)
		if err != nil {
			return nil, err
		}
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
	// Receipt reads deliberately keep the historical merge relationship after
	// checkout. Payment deactivates the merge group but leaves merge_group_id on
	// its closed sessions; an explicit split clears merge_group_id instead.
	primaryID, err := r.billingPrimaryForRead(ctx, restaurantID, diningSessionID)
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

func (r *Repository) billingPrimaryForRead(ctx context.Context, restaurantID, diningSessionID uuid.UUID) (uuid.UUID, error) {
	var primaryID uuid.UUID
	err := r.q(ctx).QueryRow(ctx, `
		SELECT member.id
		FROM dining_sessions self
		JOIN dining_sessions member
		  ON member.restaurant_id = self.restaurant_id
		 AND (
		      (self.merge_group_id IS NULL AND member.id = self.id)
		      OR (self.merge_group_id IS NOT NULL AND member.merge_group_id = self.merge_group_id)
		 )
		 AND member.deleted_at IS NULL
		WHERE self.restaurant_id = $1
		  AND self.id = $2
		  AND self.deleted_at IS NULL
		ORDER BY member.opened_at, member.id
		LIMIT 1
	`, restaurantID, diningSessionID).Scan(&primaryID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, apperr.New(apperr.CodeNotFound, "dining session not found")
	}
	return primaryID, err
}

func (r *Repository) ListPaidInvoices(ctx context.Context, restaurantID uuid.UUID, filter domain.PaidInvoiceFilter) (domain.PaidInvoicePage, error) {
	where, args := paidInvoiceWhere(restaurantID, filter)
	out := domain.PaidInvoicePage{Items: []domain.PaidInvoiceRecord{}, PaymentMethods: []domain.PaidInvoicePaymentMethod{}}

	summaryQuery := `
		SELECT COUNT(*),
		       COALESCE(SUM(i.total_amount_vnd), 0),
		       COALESCE(SUM(i.discount_amount_vnd), 0),
		       COALESCE(ROUND(AVG(i.total_amount_vnd)), 0)::bigint
		FROM invoices i
		LEFT JOIN dining_sessions ds
		  ON ds.restaurant_id = i.restaurant_id AND ds.id = i.dining_session_id AND ds.deleted_at IS NULL
		LEFT JOIN tables t
		  ON t.restaurant_id = i.restaurant_id AND t.id = ds.table_id AND t.deleted_at IS NULL
		LEFT JOIN orders o
		  ON o.restaurant_id = i.restaurant_id AND o.id = i.order_id AND o.deleted_at IS NULL
	` + where
	if err := r.q(ctx).QueryRow(ctx, summaryQuery, args...).Scan(
		&out.Summary.InvoiceCount,
		&out.Summary.TotalRevenueVND,
		&out.Summary.TotalDiscountVND,
		&out.Summary.AverageInvoiceVND,
	); err != nil {
		return domain.PaidInvoicePage{}, err
	}
	out.Total = out.Summary.InvoiceCount

	listArgs := append([]any{}, args...)
	limitPosition := len(listArgs) + 1
	listArgs = append(listArgs, filter.Limit)
	offsetPosition := len(listArgs) + 1
	listArgs = append(listArgs, filter.Offset)
	rows, err := r.q(ctx).Query(ctx, fmt.Sprintf(`
		SELECT i.id, i.invoice_number, i.paid_at,
		       i.subtotal_vnd, i.discount_amount_vnd, i.service_charge_amount_vnd,
		       i.vat_amount_vnd, i.total_amount_vnd, i.paid_amount_vnd,
		       COALESCE(ds.session_code, o.order_number, ''),
		       CASE
		         WHEN i.order_id IS NOT NULL THEN 'Mang về'
		         ELSE COALESCE(NULLIF(t.name, ''), t.code, '')
		       END,
		       COALESCE(ds.customer_name, o.customer_name, ''),
		       COALESCE((
		         SELECT SUM(ii.quantity)::int
		         FROM invoice_items ii
		         WHERE ii.restaurant_id = i.restaurant_id AND ii.invoice_id = i.id
		       ), 0),
		       COALESCE((
		         SELECT string_agg(DISTINCT pm.code, ' · ' ORDER BY pm.code)
		         FROM payments p
		         JOIN payment_methods pm
		           ON pm.restaurant_id = p.restaurant_id AND pm.id = p.payment_method_id
		         WHERE p.restaurant_id = i.restaurant_id AND p.invoice_id = i.id
		           AND p.status = 'COMPLETED' AND p.deleted_at IS NULL
		       ), ''),
		       COALESCE((
		         SELECT string_agg(DISTINCT pm.name, ' · ' ORDER BY pm.name)
		         FROM payments p
		         JOIN payment_methods pm
		           ON pm.restaurant_id = p.restaurant_id AND pm.id = p.payment_method_id
		         WHERE p.restaurant_id = i.restaurant_id AND p.invoice_id = i.id
		           AND p.status = 'COMPLETED' AND p.deleted_at IS NULL
		       ), '')
		FROM invoices i
		LEFT JOIN dining_sessions ds
		  ON ds.restaurant_id = i.restaurant_id AND ds.id = i.dining_session_id AND ds.deleted_at IS NULL
		LEFT JOIN tables t
		  ON t.restaurant_id = i.restaurant_id AND t.id = ds.table_id AND t.deleted_at IS NULL
		LEFT JOIN orders o
		  ON o.restaurant_id = i.restaurant_id AND o.id = i.order_id AND o.deleted_at IS NULL
		%s
		ORDER BY i.paid_at DESC, i.id DESC
		LIMIT $%d OFFSET $%d
	`, where, limitPosition, offsetPosition), listArgs...)
	if err != nil {
		return domain.PaidInvoicePage{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var item domain.PaidInvoiceRecord
		if err := rows.Scan(
			&item.ID,
			&item.InvoiceNumber,
			&item.PaidAt,
			&item.SubtotalVND,
			&item.DiscountAmountVND,
			&item.ServiceChargeVND,
			&item.VATAmountVND,
			&item.TotalAmountVND,
			&item.PaidAmountVND,
			&item.SessionReference,
			&item.TableLabel,
			&item.CustomerName,
			&item.ItemCount,
			&item.PaymentMethodCodes,
			&item.PaymentMethodNames,
		); err != nil {
			return domain.PaidInvoicePage{}, err
		}
		out.Items = append(out.Items, item)
	}
	if err := rows.Err(); err != nil {
		return domain.PaidInvoicePage{}, err
	}

	methodRows, err := r.q(ctx).Query(ctx, `
		SELECT DISTINCT pm.code, pm.name
		FROM payment_methods pm
		JOIN payments p
		  ON p.restaurant_id = pm.restaurant_id AND p.payment_method_id = pm.id
		  AND p.status = 'COMPLETED' AND p.deleted_at IS NULL
		JOIN invoices i
		  ON i.restaurant_id = p.restaurant_id AND i.id = p.invoice_id
		  AND i.status = 'PAID' AND i.deleted_at IS NULL
		WHERE pm.restaurant_id = $1 AND pm.deleted_at IS NULL
		ORDER BY pm.name
	`, restaurantID)
	if err != nil {
		return domain.PaidInvoicePage{}, err
	}
	defer methodRows.Close()
	for methodRows.Next() {
		var method domain.PaidInvoicePaymentMethod
		if err := methodRows.Scan(&method.Code, &method.Name); err != nil {
			return domain.PaidInvoicePage{}, err
		}
		out.PaymentMethods = append(out.PaymentMethods, method)
	}
	if err := methodRows.Err(); err != nil {
		return domain.PaidInvoicePage{}, err
	}
	return out, nil
}

func (r *Repository) GetPaidInvoice(ctx context.Context, restaurantID, invoiceID uuid.UUID) (*domain.PaidInvoiceDetail, error) {
	var detail domain.PaidInvoiceDetail
	err := r.q(ctx).QueryRow(ctx, `
		SELECT COALESCE(ds.session_code, o.order_number, ''),
		       CASE
		         WHEN i.order_id IS NOT NULL THEN 'Mang về'
		         ELSE COALESCE(NULLIF(t.name, ''), t.code, '')
		       END,
		       COALESCE(ds.customer_name, o.customer_name, ''),
		       COALESCE(ds.customer_phone, o.customer_phone, '')
		FROM invoices i
		LEFT JOIN dining_sessions ds
		  ON ds.restaurant_id = i.restaurant_id AND ds.id = i.dining_session_id AND ds.deleted_at IS NULL
		LEFT JOIN tables t
		  ON t.restaurant_id = i.restaurant_id AND t.id = ds.table_id AND t.deleted_at IS NULL
		LEFT JOIN orders o
		  ON o.restaurant_id = i.restaurant_id AND o.id = i.order_id AND o.deleted_at IS NULL
		WHERE i.restaurant_id = $1 AND i.id = $2
		  AND i.status = 'PAID' AND i.deleted_at IS NULL
	`, restaurantID, invoiceID).Scan(
		&detail.Context.SessionReference,
		&detail.Context.TableLabel,
		&detail.Context.CustomerName,
		&detail.Context.CustomerPhone,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "paid invoice not found")
	}
	if err != nil {
		return nil, err
	}
	invoice, err := r.LoadInvoice(ctx, restaurantID, invoiceID)
	if err != nil {
		return nil, err
	}
	if invoice.Status != domain.InvoicePaid {
		return nil, apperr.New(apperr.CodeNotFound, "paid invoice not found")
	}
	detail.Invoice = invoice
	return &detail, nil
}

func paidInvoiceWhere(restaurantID uuid.UUID, filter domain.PaidInvoiceFilter) (string, []any) {
	conditions := []string{
		"i.restaurant_id = $1",
		"i.status = 'PAID'",
		"i.deleted_at IS NULL",
		"i.paid_at IS NOT NULL",
	}
	args := []any{restaurantID}
	add := func(condition string, value any) {
		args = append(args, value)
		conditions = append(conditions, fmt.Sprintf(condition, len(args)))
	}
	if filter.From != nil {
		add(`i.paid_at >= (
			$%d::date AT TIME ZONE COALESCE(
				(SELECT restaurant.timezone FROM restaurants restaurant WHERE restaurant.id = i.restaurant_id),
				'Asia/Ho_Chi_Minh'
			)
		)`, *filter.From)
	}
	if filter.ToExclusive != nil {
		add(`i.paid_at < (
			$%d::date AT TIME ZONE COALESCE(
				(SELECT restaurant.timezone FROM restaurants restaurant WHERE restaurant.id = i.restaurant_id),
				'Asia/Ho_Chi_Minh'
			)
		)`, *filter.ToExclusive)
	}
	if filter.Search != "" {
		add(`(
			i.invoice_number ILIKE $%[1]d
			OR COALESCE(ds.session_code, '') ILIKE $%[1]d
			OR COALESCE(t.code, '') ILIKE $%[1]d
			OR COALESCE(t.name, '') ILIKE $%[1]d
			OR COALESCE(ds.customer_name, o.customer_name, '') ILIKE $%[1]d
			OR COALESCE(ds.customer_phone, o.customer_phone, '') ILIKE $%[1]d
			OR COALESCE(o.order_number, '') ILIKE $%[1]d
			OR EXISTS (
				SELECT 1 FROM payments search_payment
				WHERE search_payment.restaurant_id = i.restaurant_id
				  AND search_payment.invoice_id = i.id
				  AND search_payment.deleted_at IS NULL
				  AND (
				    COALESCE(search_payment.payment_number, '') ILIKE $%[1]d
				    OR COALESCE(search_payment.reference_code, '') ILIKE $%[1]d
				  )
			)
		)`, "%"+filter.Search+"%")
	}
	if filter.PaymentMethodCode != "" {
		add(`EXISTS (
			SELECT 1
			FROM payments method_payment
			JOIN payment_methods method
			  ON method.restaurant_id = method_payment.restaurant_id
			  AND method.id = method_payment.payment_method_id
			WHERE method_payment.restaurant_id = i.restaurant_id
			  AND method_payment.invoice_id = i.id
			  AND method_payment.status = 'COMPLETED'
			  AND method_payment.deleted_at IS NULL
			  AND LOWER(method.code) = $%d
		)`, filter.PaymentMethodCode)
	}
	return "WHERE " + strings.Join(conditions, "\n AND "), args
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
	closedSessionIDs, err := r.closeSessionAndFreeTable(ctx, restaurantID, diningSessionID, input.ProcessedBy)
	if err != nil {
		return nil, err
	}
	_ = paymentID
	invoice, err := r.LoadInvoice(ctx, restaurantID, input.InvoiceID)
	if err != nil {
		return nil, err
	}
	invoice.ClosedSessionIDs = closedSessionIDs
	return invoice, nil
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
		closedSessionIDs, err := r.closeSessionAndFreeTable(ctx, restaurantID, diningSessionID, input.ProcessedBy)
		if err != nil {
			return nil, err
		}
		invoice, err := r.LoadInvoice(ctx, restaurantID, input.InvoiceID)
		if err != nil {
			return nil, err
		}
		invoice.ClosedSessionIDs = closedSessionIDs
		return invoice, nil
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
		SELECT id, restaurant_id, invoice_id, COALESCE(dining_session_id, order_id), payment_number, amount_vnd,
		       COALESCE(NULLIF(transaction_data->>'expected_webhook_amount_vnd', '')::bigint, amount_vnd),
		       status
		FROM payments
		WHERE deleted_at IS NULL
		  AND (($1 <> '' AND gateway_transaction_id = $1) OR ($2 <> '' AND payment_number = $2))
		ORDER BY created_at DESC
		LIMIT 1
	`, strings.TrimSpace(gatewayTransactionID), strings.TrimSpace(orderRef)).Scan(
		&payment.ID,
		&payment.RestaurantID,
		&payment.InvoiceID,
		&payment.DiningSessionID,
		&payment.PaymentNumber,
		&payment.AmountVND,
		&payment.WebhookAmountVND,
		&payment.Status,
	)
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
	if err := r.lockPaymentDiningSession(ctx, restaurantID, paymentID); err != nil {
		return nil, err
	}
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
		    received_amount_vnd = $5,
		    change_amount_vnd = 0,
		    processed_at = NOW(),
		    gateway_transaction_id = COALESCE(NULLIF($3, ''), gateway_transaction_id),
		    transaction_data = COALESCE(transaction_data, '{}'::jsonb) || $4::jsonb,
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, paymentID, event.GatewayTransactionID, payload, event.AmountVND)
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
	closedSessionIDs, err := r.closeSessionAndFreeTable(ctx, restaurantID, payment.DiningSessionID, uuid.Nil)
	if err != nil {
		return nil, err
	}
	invoice, err := r.LoadInvoice(ctx, restaurantID, payment.InvoiceID)
	if err != nil {
		return nil, err
	}
	invoice.ClosedSessionIDs = closedSessionIDs
	return invoice, nil
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

func (r *Repository) CancelProcessingPayment(ctx context.Context, restaurantID, invoiceID, paymentID uuid.UUID) (*domain.Invoice, error) {
	payment, err := r.lockPayment(ctx, restaurantID, paymentID)
	if err != nil {
		return nil, err
	}
	if payment.InvoiceID != invoiceID {
		return nil, apperr.New(apperr.CodeNotFound, "payment not found for invoice")
	}
	switch payment.Status {
	case domain.PaymentFailed:
		return r.LoadInvoice(ctx, restaurantID, invoiceID)
	case domain.PaymentCompleted, domain.PaymentRefunded:
		return nil, apperr.New(apperr.CodeConflict, "completed payment cannot be cancelled")
	case domain.PaymentPending, domain.PaymentProcessing:
		// Continue below. Marking the row FAILED invalidates the old QR reference,
		// allowing PrepareAsyncPayment to create a fresh payment number on retry.
	default:
		return nil, apperr.New(apperr.CodeConflict, "payment cannot be cancelled")
	}

	commandTag, err := r.q(ctx).Exec(ctx, `
		UPDATE payments
		SET status = 'FAILED',
		    processed_at = NOW(),
		    transaction_data = COALESCE(transaction_data, '{}'::jsonb)
		        || '{"cancel_reason":"cancelled_by_cashier"}'::jsonb,
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1
		  AND invoice_id = $2
		  AND id = $3
		  AND status IN ('PENDING', 'PROCESSING')
		  AND deleted_at IS NULL
	`, restaurantID, invoiceID, paymentID)
	if err != nil {
		return nil, err
	}
	if commandTag.RowsAffected() != 1 {
		return nil, apperr.New(apperr.CodeConflict, "payment status changed while cancelling")
	}
	return r.LoadInvoice(ctx, restaurantID, invoiceID)
}

// CancelSession atomically voids every still-unpaid invoice, closes all members
// of a merged dining session, and releases their tables. Completed/processing
// payments must be handled explicitly before cancellation so accounting data is
// never discarded by a session-level action.
func (r *Repository) CancelSession(ctx context.Context, restaurantID, sessionID, actorID uuid.UUID) (*domain.SessionCancellationResult, error) {
	primaryID, memberIDs, err := r.billingSessions(ctx, restaurantID, sessionID)
	if err != nil {
		return nil, err
	}

	rows, err := r.q(ctx).Query(ctx, `
		SELECT id, status
		FROM dining_sessions
		WHERE restaurant_id = $1 AND id = ANY($2) AND deleted_at IS NULL
		ORDER BY CASE WHEN id = $3 THEN 0 ELSE 1 END, id
		FOR UPDATE
	`, restaurantID, memberIDs, primaryID)
	if err != nil {
		return nil, err
	}
	allClosed := true
	lockedCount := 0
	for rows.Next() {
		var id uuid.UUID
		var status string
		if err := rows.Scan(&id, &status); err != nil {
			rows.Close()
			return nil, err
		}
		lockedCount++
		if status != "CLOSED" {
			allClosed = false
		}
		if status != "ACTIVE" && status != "AWAITING_PAYMENT" && status != "CLOSED" {
			rows.Close()
			return nil, apperr.New(apperr.CodeConflict, "dining session is not cancellable")
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if lockedCount != len(memberIDs) {
		return nil, apperr.New(apperr.CodeNotFound, "dining session not found")
	}
	if allClosed {
		return &domain.SessionCancellationResult{
			SessionID:  primaryID,
			SessionIDs: memberIDs,
			ClosedNow:  false,
		}, nil
	}

	var hasInFlightPayment bool
	if err := r.q(ctx).QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM payments p
			JOIN invoices i
			  ON i.restaurant_id = p.restaurant_id AND i.id = p.invoice_id
			WHERE i.restaurant_id = $1
			  AND i.dining_session_id = ANY($2)
			  AND i.deleted_at IS NULL
			  AND p.status IN ('PENDING', 'PROCESSING')
			  AND p.deleted_at IS NULL
		)
	`, restaurantID, memberIDs).Scan(&hasInFlightPayment); err != nil {
		return nil, err
	}
	if hasInFlightPayment {
		return nil, apperr.New(apperr.CodeConflict, "cancel the active payment before cancelling the session")
	}

	var hasPartialPayment bool
	if err := r.q(ctx).QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM invoices
			WHERE restaurant_id = $1
			  AND dining_session_id = ANY($2)
			  AND status = 'PARTIALLY_PAID'
			  AND deleted_at IS NULL
		)
	`, restaurantID, memberIDs).Scan(&hasPartialPayment); err != nil {
		return nil, err
	}
	if hasPartialPayment {
		return nil, apperr.New(apperr.CodeConflict, "partially paid session cannot be cancelled")
	}

	voidRows, err := r.q(ctx).Query(ctx, `
		UPDATE invoices
		SET status = 'VOID',
		    voided_reason = 'CANCELLED_BY_CASHIER',
		    voided_at = NOW(),
		    voided_by = $3,
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1
		  AND dining_session_id = ANY($2)
		  AND status IN ('DRAFT', 'PENDING')
		  AND deleted_at IS NULL
		RETURNING id
	`, restaurantID, memberIDs, actorID)
	if err != nil {
		return nil, err
	}
	voidedInvoiceIDs := make([]uuid.UUID, 0)
	for voidRows.Next() {
		var invoiceID uuid.UUID
		if err := voidRows.Scan(&invoiceID); err != nil {
			voidRows.Close()
			return nil, err
		}
		voidedInvoiceIDs = append(voidedInvoiceIDs, invoiceID)
	}
	voidRows.Close()
	if err := voidRows.Err(); err != nil {
		return nil, err
	}

	if _, err := r.q(ctx).Exec(ctx, `
		UPDATE dining_sessions
		SET status = 'CLOSED',
		    closed_at = COALESCE(closed_at, NOW()),
		    closed_by = COALESCE(closed_by, $3),
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1
		  AND id = ANY($2)
		  AND status <> 'CLOSED'
		  AND deleted_at IS NULL
	`, restaurantID, memberIDs, actorID); err != nil {
		return nil, err
	}

	if _, err := r.q(ctx).Exec(ctx, `
		UPDATE tables
		SET status = 'AVAILABLE', version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1
		  AND id IN (
			SELECT table_id
			FROM dining_sessions
			WHERE restaurant_id = $1 AND id = ANY($2) AND deleted_at IS NULL
		  )
		  AND deleted_at IS NULL
	`, restaurantID, memberIDs); err != nil {
		return nil, err
	}

	if len(memberIDs) > 1 {
		if _, err := r.q(ctx).Exec(ctx, `
			UPDATE table_merge_groups
			SET is_active = FALSE, version = version + 1, updated_at = NOW()
			WHERE restaurant_id = $1
			  AND id = (
				SELECT merge_group_id
				FROM dining_sessions
				WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
			  )
			  AND is_active = TRUE
			  AND deleted_at IS NULL
		`, restaurantID, primaryID); err != nil {
			return nil, err
		}
	}

	return &domain.SessionCancellationResult{
		SessionID:        primaryID,
		SessionIDs:       memberIDs,
		VoidedInvoiceIDs: voidedInvoiceIDs,
		ClosedNow:        true,
	}, nil
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
	// Keep the global billing lock order session -> invoice -> payment. SplitInvoice
	// uses the same order, so a cashier payment cannot deadlock with a concurrent split.
	var linkedSessionID pgtype.UUID
	err := r.q(ctx).QueryRow(ctx, `
		SELECT dining_session_id
		FROM invoices
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, invoiceID).Scan(&linkedSessionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, false, 0, apperr.New(apperr.CodeNotFound, "invoice not found")
	}
	if err != nil {
		return uuid.Nil, false, 0, err
	}
	if linkedSessionID.Valid {
		if err := r.lockDiningSession(ctx, restaurantID, uuid.UUID(linkedSessionID.Bytes)); err != nil {
			return uuid.Nil, false, 0, err
		}
	}

	var diningSessionID, orderID pgtype.UUID
	var invoiceStatus string
	var totalAmount int64
	err = r.q(ctx).QueryRow(ctx, `
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

func (r *Repository) lockPaymentDiningSession(ctx context.Context, restaurantID, paymentID uuid.UUID) error {
	// Webhook completion also follows session -> payment -> invoice. The preliminary
	// read is revalidated by lockPayment after the session lock is acquired.
	var diningSessionID pgtype.UUID
	err := r.q(ctx).QueryRow(ctx, `
		SELECT i.dining_session_id
		FROM payments p
		JOIN invoices i ON i.restaurant_id = p.restaurant_id AND i.id = p.invoice_id
		WHERE p.restaurant_id = $1 AND p.id = $2
		  AND p.deleted_at IS NULL AND i.deleted_at IS NULL
	`, restaurantID, paymentID).Scan(&diningSessionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return apperr.New(apperr.CodeNotFound, "payment not found")
	}
	if err != nil {
		return err
	}
	if !diningSessionID.Valid {
		return nil
	}
	return r.lockDiningSession(ctx, restaurantID, uuid.UUID(diningSessionID.Bytes))
}

func (r *Repository) lockDiningSession(ctx context.Context, restaurantID, diningSessionID uuid.UUID) error {
	var lockedID uuid.UUID
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id
		FROM dining_sessions
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`, restaurantID, diningSessionID).Scan(&lockedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return apperr.New(apperr.CodeNotFound, "dining session not found")
	}
	return err
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
		SELECT p.id, p.invoice_id, COALESCE(p.dining_session_id, p.order_id), p.payment_number,
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
		SELECT id, restaurant_id, invoice_id, COALESCE(dining_session_id, order_id), payment_number, amount_vnd,
		       COALESCE(NULLIF(transaction_data->>'expected_webhook_amount_vnd', '')::bigint, amount_vnd),
		       status
		FROM payments
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`, restaurantID, paymentID).Scan(
		&payment.ID,
		&payment.RestaurantID,
		&payment.InvoiceID,
		&payment.DiningSessionID,
		&payment.PaymentNumber,
		&payment.AmountVND,
		&payment.WebhookAmountVND,
		&payment.Status,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "payment not found")
	}
	if err != nil {
		return nil, err
	}
	return payment, nil
}

func (r *Repository) closeSessionAndFreeTable(ctx context.Context, restaurantID, diningSessionID, actorID uuid.UUID) ([]uuid.UUID, error) {
	primaryID, memberIDs, err := r.billingSessions(ctx, restaurantID, diningSessionID)
	if err != nil {
		return nil, err
	}

	var openInvoices int
	if err := r.q(ctx).QueryRow(ctx, `
		SELECT COUNT(*) FROM invoices
		WHERE restaurant_id = $1
		  AND (dining_session_id = ANY($2) OR order_id = $3)
		  AND status NOT IN ('PAID', 'VOID') AND deleted_at IS NULL
	`, restaurantID, memberIDs, primaryID).Scan(&openInvoices); err != nil {
		return nil, err
	}
	if !shouldCloseSession(openInvoices) {
		return nil, nil
	}

	var lockedSessionID uuid.UUID
	err = r.q(ctx).QueryRow(ctx, `
		SELECT id
		FROM dining_sessions
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`, restaurantID, primaryID).Scan(&lockedSessionID)
	if errors.Is(err, pgx.ErrNoRows) {
		// Might be a Takeaway order
		var orderType string
		err = r.q(ctx).QueryRow(ctx, `
			SELECT order_type FROM orders
			WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		`, restaurantID, primaryID).Scan(&orderType)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperr.New(apperr.CodeNotFound, "dining session or order not found")
		}
		if err != nil {
			return nil, err
		}
		if orderType == "TAKEAWAY" {
			_, err = r.q(ctx).Exec(ctx, `
				UPDATE orders SET status = 'PAID', updated_at = NOW()
				WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
			`, restaurantID, primaryID)
			return nil, err
		}
		return nil, apperr.New(apperr.CodeInvalid, "not a valid session or takeaway order")
	}
	if err != nil {
		return nil, err
	}
	var actor any
	if actorID != uuid.Nil {
		actor = actorID
	}
	if _, err := r.q(ctx).Exec(ctx, `
		UPDATE dining_sessions
		SET status = 'CLOSED', closed_at = COALESCE(closed_at, NOW()), closed_by = COALESCE(closed_by, $3), version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = ANY($2) AND status <> 'CLOSED' AND deleted_at IS NULL
	`, restaurantID, memberIDs, actor); err != nil {
		return nil, err
	}
	if _, err := r.q(ctx).Exec(ctx, `
		UPDATE tables
		SET status = 'AVAILABLE', version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1
		  AND id IN (
			SELECT table_id FROM dining_sessions
			WHERE restaurant_id = $1 AND id = ANY($2) AND deleted_at IS NULL
		  )
		  AND deleted_at IS NULL
	`, restaurantID, memberIDs); err != nil {
		return nil, err
	}
	if len(memberIDs) > 1 {
		if _, err := r.q(ctx).Exec(ctx, `
			UPDATE table_merge_groups
			SET is_active = FALSE, version = version + 1, updated_at = NOW()
			WHERE restaurant_id = $1
			  AND id = (
				SELECT merge_group_id FROM dining_sessions
				WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
			  )
			  AND is_active = TRUE
			  AND deleted_at IS NULL
		`, restaurantID, primaryID); err != nil {
			return nil, err
		}
	}
	return memberIDs, nil
}

type billableItem struct {
	OrderItemID       uuid.UUID
	NameSnapshot      string
	IsTakeaway        bool
	UnitPriceVND      int64
	Quantity          int
	SubtotalVND       int64
	DiscountAmountVND int64
	TotalAmountVND    int64
}

func (r *Repository) billableItems(ctx context.Context, restaurantID uuid.UUID, diningSessionIDs []uuid.UUID) ([]billableItem, int64, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT oi.id, oi.item_name_snapshot, oi.is_takeaway, oi.unit_price_vnd, oi.quantity,
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
		if err := rows.Scan(&item.OrderItemID, &item.NameSnapshot, &item.IsTakeaway, &item.UnitPriceVND, &item.Quantity, &item.SubtotalVND, &item.DiscountAmountVND, &item.TotalAmountVND); err != nil {
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
			restaurant_id, invoice_id, order_item_id, item_type, name_snapshot, is_takeaway,
			unit_price_vnd, quantity, subtotal_vnd, discount_amount_vnd, total_amount_vnd, display_order
		)
		VALUES ($1, $2, $3, 'MENU_ITEM', $4, $5, $6, $7, $8, $9, $10, $11)
	`, restaurantID, invoiceID, item.OrderItemID, item.NameSnapshot, item.IsTakeaway, item.UnitPriceVND, item.Quantity, item.SubtotalVND, item.DiscountAmountVND, item.TotalAmountVND, displayOrder)
	return err
}

func (r *Repository) loadInvoiceItems(ctx context.Context, restaurantID, invoiceID uuid.UUID) ([]domain.InvoiceItem, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT id, invoice_id, order_item_id, name_snapshot, is_takeaway, unit_price_vnd, quantity,
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
		if err := rows.Scan(&item.ID, &item.InvoiceID, &orderItemID, &item.NameSnapshot, &item.IsTakeaway, &item.UnitPriceVND, &item.Quantity, &item.SubtotalVND, &item.DiscountAmountVND, &item.TotalAmountVND); err != nil {
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
		SELECT p.id, p.invoice_id, COALESCE(p.dining_session_id, p.order_id), p.payment_number,
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
		SELECT p.id, p.invoice_id, COALESCE(p.dining_session_id, p.order_id), p.payment_number,
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
