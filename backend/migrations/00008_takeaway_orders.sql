-- +goose Up
-- +goose StatementBegin

-- Allow takeaway orders without a dining session
ALTER TABLE orders ALTER COLUMN dining_session_id DROP NOT NULL;

-- Extend order_type to support TAKEAWAY
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_order_type;
ALTER TABLE orders ADD CONSTRAINT chk_orders_order_type
    CHECK (order_type IN ('INITIAL', 'ADDITIONAL', 'TAKEAWAY'));

-- Takeaway-specific fields
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_time TIMESTAMPTZ;

-- Order items and kitchen tickets also cascade from the session
ALTER TABLE order_items ALTER COLUMN dining_session_id DROP NOT NULL;
ALTER TABLE kitchen_tickets ALTER COLUMN dining_session_id DROP NOT NULL;
ALTER TABLE kitchen_tickets ALTER COLUMN table_id DROP NOT NULL;

-- Index for kitchen to find takeaway orders
CREATE INDEX IF NOT EXISTS idx_orders_takeaway_queue
    ON orders(restaurant_id, status)
    WHERE order_type = 'TAKEAWAY' AND status = 'SUBMITTED' AND deleted_at IS NULL;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS idx_orders_takeaway_queue;
ALTER TABLE orders DROP COLUMN IF EXISTS pickup_time;
ALTER TABLE orders DROP COLUMN IF EXISTS customer_phone;
ALTER TABLE orders DROP COLUMN IF EXISTS customer_name;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_order_type;
ALTER TABLE orders ADD CONSTRAINT chk_orders_order_type
    CHECK (order_type IN ('INITIAL', 'ADDITIONAL'));
ALTER TABLE orders ALTER COLUMN dining_session_id SET NOT NULL;
ALTER TABLE order_items ALTER COLUMN dining_session_id SET NOT NULL;
ALTER TABLE kitchen_tickets ALTER COLUMN dining_session_id SET NOT NULL;
ALTER TABLE kitchen_tickets ALTER COLUMN table_id SET NOT NULL;

-- +goose StatementEnd
