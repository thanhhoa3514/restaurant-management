-- +goose Up
-- +goose StatementBegin

CREATE INDEX IF NOT EXISTS idx_invoices_paid_ledger
    ON invoices (restaurant_id, paid_at DESC, id DESC)
    WHERE status = 'PAID' AND deleted_at IS NULL AND paid_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_completed_invoice_method
    ON payments (restaurant_id, invoice_id, payment_method_id)
    WHERE status = 'COMPLETED' AND deleted_at IS NULL;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS idx_payments_completed_invoice_method;
DROP INDEX IF EXISTS idx_invoices_paid_ledger;

-- +goose StatementEnd
