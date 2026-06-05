package postgres

import (
	"context"
	"crypto/rand"
	"encoding/base64"
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

type Repository struct{ pool *pgxpool.Pool }

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

func (r *Repository) q(ctx context.Context) pg.Querier { return pg.QuerierFromContext(ctx, r.pool) }

func (r *Repository) BuildInvoice(ctx context.Context, restaurantID, diningSessionID uuid.UUID) (*domain.Invoice, bool, error) {
	var sessionID uuid.UUID
	var status string
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, status
		FROM dining_sessions
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`, restaurantID, diningSessionID).Scan(&sessionID, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, apperr.New(apperr.CodeNotFound, "dining session not found")
	}
	if err != nil {
		return nil, false, err
	}
	if status == "CLOSED" {
		return nil, false, apperr.New(apperr.CodeConflict, "dining session is closed")
	}
	if status != "ACTIVE" && status != "AWAITING_PAYMENT" {
		return nil, false, apperr.New(apperr.CodeConflict, "dining session is not billable")
	}

	var existingID uuid.UUID
	err = r.q(ctx).QueryRow(ctx, `
		SELECT id
		FROM invoices
		WHERE restaurant_id = $1
		  AND dining_session_id = $2
		  AND status <> 'VOID'
		  AND deleted_at IS NULL
		ORDER BY created_at DESC
		LIMIT 1
	`, restaurantID, diningSessionID).Scan(&existingID)
	if err == nil {
		invoice, loadErr := r.LoadInvoice(ctx, restaurantID, existingID)
		return invoice, false, loadErr
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, false, err
	}

	var vatBPS, serviceBPS int
	if err := r.q(ctx).QueryRow(ctx, `
		SELECT vat_rate_basis_points, service_charge_basis_points
		FROM restaurants
		WHERE id = $1 AND deleted_at IS NULL
	`, restaurantID).Scan(&vatBPS, &serviceBPS); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, false, apperr.New(apperr.CodeNotFound, "restaurant not found")
		}
		return nil, false, err
	}

	items, subtotal, err := r.billableItems(ctx, restaurantID, diningSessionID)
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
	err = r.q(ctx).QueryRow(ctx, `
		INSERT INTO invoices (
			restaurant_id, dining_session_id, invoice_number, invoice_type, status,
			subtotal_vnd, discount_amount_vnd, discount_reason,
			service_charge_basis_points, service_charge_amount_vnd,
			vat_basis_points, vat_amount_vnd, rounding_amount_vnd, total_amount_vnd
		)
		VALUES ($1, $2, $3, 'STANDARD', 'PENDING', $4, 0, NULL, $5, $6, $7, $8, 0, $9)
		RETURNING id
	`, restaurantID, diningSessionID, invoiceNumber, subtotal, serviceBPS, serviceAmount, vatBPS, vatAmount, total).Scan(&invoiceID)
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

	_, err = r.q(ctx).Exec(ctx, `
		UPDATE dining_sessions
		SET status = 'AWAITING_PAYMENT', version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL
	`, restaurantID, diningSessionID)
	if err != nil {
		return nil, false, err
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
	diningSessionID, totalAmount, err := r.lockPayableInvoice(ctx, restaurantID, input.InvoiceID)
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
	err = r.q(ctx).QueryRow(ctx, `
		INSERT INTO payments (
			restaurant_id, invoice_id, dining_session_id, payment_number, payment_method_id,
			amount_vnd, status, reference_code, received_amount_vnd, change_amount_vnd,
			processed_at, processed_by
		)
		VALUES ($1, $2, $3, $4, $5, $6, 'COMPLETED', $7, $8, $9, NOW(), $10)
		RETURNING id
	`, restaurantID, input.InvoiceID, diningSessionID, paymentNumber, method.ID, totalAmount, reference, input.ReceivedAmountVND, change, input.ProcessedBy).Scan(&paymentID)
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

func (r *Repository) PrepareAsyncPayment(ctx context.Context, restaurantID uuid.UUID, input domain.AsyncPaymentInput) (*domain.AsyncPaymentPreparation, error) {
	diningSessionID, totalAmount, err := r.lockPayableInvoice(ctx, restaurantID, input.InvoiceID)
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

	paymentNumber, err := randomCode("PAY", 12)
	if err != nil {
		return nil, err
	}
	var paymentID uuid.UUID
	err = r.q(ctx).QueryRow(ctx, `
		INSERT INTO payments (
			restaurant_id, invoice_id, dining_session_id, payment_number, payment_method_id,
			amount_vnd, status, received_amount_vnd, change_amount_vnd, processed_by
		)
		VALUES ($1, $2, $3, $4, $5, $6, 'PROCESSING', NULL, 0, $7)
		RETURNING id
	`, restaurantID, input.InvoiceID, diningSessionID, paymentNumber, method.ID, totalAmount, input.ProcessedBy).Scan(&paymentID)
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
		    transaction_data = COALESCE(transaction_data, '{}'::jsonb) || $3::jsonb,
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, paymentID, payload)
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
		SELECT id, restaurant_id, dining_session_id, invoice_number, status,
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
	return inv, nil
}

func (r *Repository) lockPayableInvoice(ctx context.Context, restaurantID, invoiceID uuid.UUID) (uuid.UUID, int64, error) {
	var diningSessionID uuid.UUID
	var invoiceStatus string
	var totalAmount int64
	err := r.q(ctx).QueryRow(ctx, `
		SELECT dining_session_id, status, total_amount_vnd
		FROM invoices
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`, restaurantID, invoiceID).Scan(&diningSessionID, &invoiceStatus, &totalAmount)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, 0, apperr.New(apperr.CodeNotFound, "invoice not found")
	}
	if err != nil {
		return uuid.Nil, 0, err
	}
	if invoiceStatus == "PAID" {
		return uuid.Nil, 0, apperr.New(apperr.CodeConflict, "invoice already paid")
	}
	if invoiceStatus == "VOID" || invoiceStatus == "REFUNDED" {
		return uuid.Nil, 0, apperr.New(apperr.CodeConflict, "invoice is not payable")
	}
	return diningSessionID, totalAmount, nil
}

func (r *Repository) ensureNoPaymentConflict(ctx context.Context, restaurantID, invoiceID, allowedProcessingMethodID uuid.UUID) error {
	var completed, processing bool
	if err := r.q(ctx).QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM payments WHERE restaurant_id = $1 AND invoice_id = $2 AND status = 'COMPLETED' AND deleted_at IS NULL)
	`, restaurantID, invoiceID).Scan(&completed); err != nil {
		return err
	}
	if completed {
		return apperr.New(apperr.CodeConflict, "invoice already has a completed payment")
	}
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
	var tableID uuid.UUID
	err := r.q(ctx).QueryRow(ctx, `
		SELECT table_id
		FROM dining_sessions
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`, restaurantID, diningSessionID).Scan(&tableID)
	if errors.Is(err, pgx.ErrNoRows) {
		return apperr.New(apperr.CodeNotFound, "dining session not found")
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
	if _, err := r.q(ctx).Exec(ctx, `
		UPDATE tables
		SET status = 'AVAILABLE', version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, tableID); err != nil {
		return err
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

func (r *Repository) billableItems(ctx context.Context, restaurantID, diningSessionID uuid.UUID) ([]billableItem, int64, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT oi.id, oi.item_name_snapshot, oi.unit_price_vnd, oi.quantity,
		       oi.subtotal_vnd, oi.discount_amount_vnd, oi.total_amount_vnd
		FROM order_items oi
		JOIN orders o ON o.restaurant_id = oi.restaurant_id AND o.id = oi.order_id
		WHERE oi.restaurant_id = $1
		  AND oi.dining_session_id = $2
		  AND oi.deleted_at IS NULL
		  AND oi.status <> 'CANCELLED'
		  AND o.deleted_at IS NULL
		  AND o.status <> 'CANCELLED'
		ORDER BY o.submitted_at, oi.created_at, oi.id
	`, restaurantID, diningSessionID)
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
