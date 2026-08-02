-- +goose Up
-- +goose StatementBegin

-- The composite key lets the device FK enforce that its restaurant belongs to
-- the same tenant as the dining session. PostgreSQL requires the referenced
-- columns to be unique, even though id is already the primary key.
ALTER TABLE dining_sessions
    ADD CONSTRAINT uq_dining_sessions_restaurant_id_id UNIQUE (restaurant_id, id);

CREATE TABLE session_devices (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    session_id    uuid NOT NULL,
    device_id     text NOT NULL,
    guest_name    text NOT NULL DEFAULT '',
    status        text NOT NULL DEFAULT 'PENDING',
    session_token text NOT NULL,
    is_owner      boolean NOT NULL DEFAULT false,
    approved_by   uuid REFERENCES users(id) ON DELETE SET NULL,
    approved_at   timestamptz,
    created_at    timestamptz NOT NULL DEFAULT NOW(),
    updated_at    timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_session_devices_session_tenant
        FOREIGN KEY (restaurant_id, session_id)
        REFERENCES dining_sessions (restaurant_id, id)
        ON DELETE CASCADE,
    CONSTRAINT uq_session_devices_session_device UNIQUE (session_id, device_id),
    CONSTRAINT uq_session_devices_token UNIQUE (session_token),
    CONSTRAINT ck_session_devices_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

-- Preserve credentials issued before the per-device rollout. Open sessions
-- continue working immediately after deploy; sessions still waiting for a
-- waiter remain pending and do not bypass the new approval gate.
INSERT INTO session_devices (
    restaurant_id,
    session_id,
    device_id,
    guest_name,
    status,
    session_token,
    is_owner,
    approved_by,
    approved_at,
    created_at,
    updated_at
)
SELECT
    ds.restaurant_id,
    ds.id,
    'legacy:' || ds.id::text,
    COALESCE(ds.customer_name, ''),
    CASE
        WHEN ds.status = 'PENDING_VERIFICATION' THEN 'PENDING'
        ELSE 'APPROVED'
    END,
    ds.session_token,
    TRUE,
    CASE
        WHEN ds.status = 'PENDING_VERIFICATION' THEN NULL
        ELSE ds.opened_by
    END,
    CASE
        WHEN ds.status = 'PENDING_VERIFICATION' THEN NULL
        ELSE ds.opened_at
    END,
    ds.opened_at,
    NOW()
FROM dining_sessions ds
WHERE ds.session_token IS NOT NULL;

-- Waiter's "who is waiting" list scans pending devices per restaurant.
CREATE INDEX IF NOT EXISTS idx_session_devices_pending
    ON session_devices (restaurant_id, created_at)
    WHERE status = 'PENDING';

-- PostgreSQL does not auto-index foreign-key columns. These keep restaurant
-- cascade and user SET NULL operations from scanning the whole device table.
CREATE INDEX idx_session_devices_restaurant
    ON session_devices (restaurant_id);

CREATE INDEX idx_session_devices_approved_by
    ON session_devices (approved_by)
    WHERE approved_by IS NOT NULL;

-- A session can have only one first/owner device. The partial index stays
-- compact because all non-owner joiners are excluded.
CREATE UNIQUE INDEX uq_session_devices_one_owner
    ON session_devices (session_id)
    WHERE is_owner;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS session_devices;

ALTER TABLE dining_sessions
    DROP CONSTRAINT IF EXISTS uq_dining_sessions_restaurant_id_id;

-- +goose StatementEnd
