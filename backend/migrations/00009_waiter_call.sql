-- +goose Up
ALTER TABLE dining_sessions ADD COLUMN IF NOT EXISTS waiter_called_at TIMESTAMPTZ;

-- +goose Down
ALTER TABLE dining_sessions DROP COLUMN IF EXISTS waiter_called_at;
