-- +goose Up
-- +goose StatementBegin

CREATE INDEX IF NOT EXISTS idx_dining_sessions_daily_history
    ON dining_sessions (restaurant_id, opened_at DESC)
    WHERE deleted_at IS NULL;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS idx_dining_sessions_daily_history;

-- +goose StatementEnd
