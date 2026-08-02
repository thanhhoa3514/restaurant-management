-- +goose Up
-- +goose StatementBegin

-- A paid standalone takeaway order is terminal but still needs to remain in the
-- order ledger. The original constraint predates takeaway billing and rejected
-- the PAID transition, rolling the whole payment transaction back.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_status;
ALTER TABLE orders
    ADD CONSTRAINT chk_orders_status
    CHECK (status IN ('SUBMITTED', 'CANCELLED', 'PAID')) NOT VALID;
ALTER TABLE orders VALIDATE CONSTRAINT chk_orders_status;

-- Preserve the fulfilment mode on the invoice snapshot. Reading it from the live
-- order item later would make historical receipts depend on mutable order data.
ALTER TABLE invoice_items
    ADD COLUMN IF NOT EXISTS is_takeaway BOOLEAN NOT NULL DEFAULT FALSE;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE invoice_items DROP COLUMN IF EXISTS is_takeaway;

-- Convert the new terminal state before restoring the narrower legacy check.
UPDATE orders SET status = 'SUBMITTED' WHERE status = 'PAID';
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_status;
ALTER TABLE orders
    ADD CONSTRAINT chk_orders_status
    CHECK (status IN ('SUBMITTED', 'CANCELLED')) NOT VALID;
ALTER TABLE orders VALIDATE CONSTRAINT chk_orders_status;

-- +goose StatementEnd
