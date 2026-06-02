-- +goose Up
ALTER TABLE dining_sessions ADD COLUMN session_token VARCHAR(255);
CREATE UNIQUE INDEX uq_dining_sessions_token ON dining_sessions(session_token) WHERE session_token IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS uq_dining_sessions_token;
ALTER TABLE dining_sessions DROP COLUMN IF EXISTS session_token;
