-- +goose Up
-- The outbox dispatcher previously processed ONLY 'dining.qr_scanned' events;
-- every other module's event (billing/ordering/dining) was inserted with
-- status PENDING and left unprocessed forever, because realtime was delivered
-- synchronously at write time. The dispatcher now processes ALL pending events
-- and broadcasts them to the realtime hub. Without this cutoff, the first tick
-- after deploy would pick up the entire historical backlog of already-delivered
-- events and re-broadcast them (duplicate order/payment notifications).
--
-- Mark that pre-cutoff backlog COMPLETED so only events written after this
-- migration are delivered by the new dispatcher. 'dining.qr_scanned' rows are
-- left untouched: the old dispatcher owned them, and any still-PENDING scan
-- must still get its audit row written.
UPDATE event_outbox
SET status = 'COMPLETED',
    processed_at = NOW()
WHERE status = 'PENDING'
  AND event_type <> 'dining.qr_scanned';

-- +goose Down
-- Irreversible data migration: these events were already delivered synchronously
-- before the dispatcher change. Re-opening them would cause duplicate broadcasts,
-- so the down migration is intentionally a no-op.
SELECT 1;
