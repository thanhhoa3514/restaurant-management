-- PENDING_VERIFICATION: new session status for guest self-join flow.
-- When a guest scans a QR for an unopened table, the system now creates a
-- session in PENDING_VERIFICATION instead of requiring a staff member to
-- open it first. A staff member must explicitly verify the guest before
-- the session becomes ACTIVE and ordering is allowed.

ALTER TABLE dining_sessions
  DROP CONSTRAINT chk_dining_sessions_status;

ALTER TABLE dining_sessions
  ADD CONSTRAINT chk_dining_sessions_status
  CHECK (status IN ('PENDING_VERIFICATION', 'ACTIVE', 'AWAITING_PAYMENT', 'CLOSED'));

-- Also allow PENDING_VERIFICATION in the one-open-per-table index so that
-- duplicate guest-join requests for the same table are rejected.
DROP INDEX IF EXISTS uq_dining_sessions_one_open_per_table;

CREATE UNIQUE INDEX uq_dining_sessions_one_open_per_table
  ON dining_sessions(restaurant_id, table_id)
  WHERE status IN ('PENDING_VERIFICATION', 'ACTIVE', 'AWAITING_PAYMENT')
    AND deleted_at IS NULL;
