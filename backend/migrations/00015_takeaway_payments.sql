-- +goose Up
-- +goose StatementBegin

-- Make dining_session_id nullable
ALTER TABLE payments ALTER COLUMN dining_session_id DROP NOT NULL;

-- Add order_id to support takeaway orders directly
ALTER TABLE payments ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE CASCADE;

-- Ensure a payment belongs to EITHER a session OR an order
ALTER TABLE payments ADD CONSTRAINT chk_payments_link CHECK (dining_session_id IS NOT NULL OR order_id IS NOT NULL);

-- Index for searching payments by order_id
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(restaurant_id, order_id) WHERE order_id IS NOT NULL;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS idx_payments_order_id;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payments_link;
ALTER TABLE payments DROP COLUMN IF EXISTS order_id;
-- Note: Reverting to NOT NULL might fail if there are existing rows with NULL, but for down migration it's acceptable.
ALTER TABLE payments ALTER COLUMN dining_session_id SET NOT NULL;

-- +goose StatementEnd
