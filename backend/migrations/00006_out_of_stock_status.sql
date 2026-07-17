-- +goose Up
-- +goose StatementBegin

-- Add UNAVAILABLE to order_items status check constraint
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS chk_order_items_status;
ALTER TABLE order_items ADD CONSTRAINT chk_order_items_status
    CHECK (status IN ('PENDING','ACKNOWLEDGED','PREPARING','READY','SERVED','CANCELLED','UNAVAILABLE'));

-- Columns for tracking the unavailability reason and when it happened
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unavailable_at TIMESTAMPTZ;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unavailable_reason VARCHAR(255);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS chk_order_items_status;
ALTER TABLE order_items ADD CONSTRAINT chk_order_items_status
    CHECK (status IN ('PENDING','ACKNOWLEDGED','PREPARING','READY','SERVED','CANCELLED'));

ALTER TABLE order_items DROP COLUMN IF EXISTS unavailable_at;
ALTER TABLE order_items DROP COLUMN IF EXISTS unavailable_reason;

-- +goose StatementEnd
