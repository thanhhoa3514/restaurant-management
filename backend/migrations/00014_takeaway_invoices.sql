-- +goose Up
-- +goose StatementBegin

-- Make dining_session_id nullable
ALTER TABLE invoices ALTER COLUMN dining_session_id DROP NOT NULL;

-- Add order_id to support takeaway orders directly
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE CASCADE;

-- Ensure an invoice belongs to EITHER a session OR an order
ALTER TABLE invoices ADD CONSTRAINT chk_invoices_link CHECK (dining_session_id IS NOT NULL OR order_id IS NOT NULL);

-- Index for searching invoices by order_id
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(restaurant_id, order_id) WHERE order_id IS NOT NULL;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS idx_invoices_order_id;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS chk_invoices_link;
ALTER TABLE invoices DROP COLUMN IF EXISTS order_id;
-- Note: Reverting to NOT NULL might fail if there are existing rows with NULL, but for down migration it's acceptable.
ALTER TABLE invoices ALTER COLUMN dining_session_id SET NOT NULL;

-- +goose StatementEnd
