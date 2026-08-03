-- +goose Up
-- +goose StatementBegin

-- Authentication is per approved device. Make database ownership explicit.
ALTER TABLE session_devices
    RENAME COLUMN session_token TO access_token;

ALTER TABLE session_devices
    RENAME CONSTRAINT uq_session_devices_token TO uq_session_devices_access_token;

DROP INDEX IF EXISTS uq_dining_sessions_token;

ALTER TABLE dining_sessions
    DROP COLUMN IF EXISTS session_token;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE session_devices
    RENAME CONSTRAINT uq_session_devices_access_token TO uq_session_devices_token;

ALTER TABLE session_devices
    RENAME COLUMN access_token TO session_token;

ALTER TABLE dining_sessions
    ADD COLUMN IF NOT EXISTS session_token VARCHAR(255);

-- Restore the legacy value from the owner device where one exists. Sessions
-- opened by staff can remain NULL until a guest device joins.
UPDATE dining_sessions ds
SET session_token = owner_device.session_token
FROM session_devices owner_device
WHERE owner_device.session_id = ds.id
  AND owner_device.is_owner = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dining_sessions_token
    ON dining_sessions(session_token)
    WHERE session_token IS NOT NULL;

-- +goose StatementEnd
