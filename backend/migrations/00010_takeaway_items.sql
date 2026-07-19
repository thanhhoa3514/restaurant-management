-- +goose Up
-- +goose StatementBegin

-- Allow marking individual order_items as takeaway within a dine-in session
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_takeaway BOOLEAN NOT NULL DEFAULT false;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE order_items DROP COLUMN IF EXISTS is_takeaway;

-- +goose StatementEnd
