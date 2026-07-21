-- +goose Up
-- +goose StatementBegin

-- PLACED: new order-item status that precedes PENDING.
-- Guests (and staff) now place orders whose items land in PLACED — visible to
-- serving staff for review but hidden from the kitchen. A staff member confirms
-- each item (PLACED -> PENDING, kitchen sees it) or rejects it
-- (PLACED -> CANCELLED). This inserts a server-confirmation gate between
-- ordering and the kitchen queue.

ALTER TABLE order_items
  DROP CONSTRAINT chk_order_items_status;

ALTER TABLE order_items
  ADD CONSTRAINT chk_order_items_status
  CHECK (status IN ('PLACED', 'PENDING', 'ACKNOWLEDGED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'));

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- Collapse any un-confirmed items back into PENDING before restoring the
-- narrower constraint, otherwise the ADD CONSTRAINT would fail on live rows.
UPDATE order_items SET status = 'PENDING' WHERE status = 'PLACED';

ALTER TABLE order_items
  DROP CONSTRAINT chk_order_items_status;

ALTER TABLE order_items
  ADD CONSTRAINT chk_order_items_status
  CHECK (status IN ('PENDING', 'ACKNOWLEDGED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'));

-- +goose StatementEnd
