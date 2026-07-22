-- +goose Up
-- +goose StatementBegin

-- notifications was planned for in-app alerts but never wired to any reader or
-- writer in either backend or frontend. Drop the unused table.
DROP TABLE IF EXISTS notifications;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    recipient_type VARCHAR(40) NOT NULL,
    recipient_id UUID,
    type VARCHAR(80) NOT NULL,
    title VARCHAR(180) NOT NULL,
    message TEXT,
    data JSONB,
    priority VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_notifications_priority CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT'))
);

-- +goose StatementEnd
