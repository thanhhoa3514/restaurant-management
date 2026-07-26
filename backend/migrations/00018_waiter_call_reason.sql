-- +goose Up
-- Lý do khách bấm gọi nhân viên (thêm nước / thêm chén đũa / cần hỗ trợ …).
ALTER TABLE dining_sessions ADD COLUMN IF NOT EXISTS waiter_call_reason VARCHAR(120);

-- +goose Down
ALTER TABLE dining_sessions DROP COLUMN IF EXISTS waiter_call_reason;
