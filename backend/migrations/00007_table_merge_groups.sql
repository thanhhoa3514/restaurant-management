-- +goose Up
-- +goose StatementBegin

-- Track merge groups where multiple dining tables are combined for one party
CREATE TABLE IF NOT EXISTS table_merge_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    merged_by UUID REFERENCES users(id),
    note TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link dining sessions to their merge group (nullable = not merged)
ALTER TABLE dining_sessions ADD COLUMN IF NOT EXISTS merge_group_id UUID REFERENCES table_merge_groups(id);

-- Index for finding all sessions in a merge group
CREATE INDEX IF NOT EXISTS idx_dining_sessions_merge_group ON dining_sessions(restaurant_id, merge_group_id)
    WHERE merge_group_id IS NOT NULL AND deleted_at IS NULL;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS idx_dining_sessions_merge_group;
ALTER TABLE dining_sessions DROP COLUMN IF EXISTS merge_group_id;
DROP TABLE IF EXISTS table_merge_groups;

-- +goose StatementEnd
