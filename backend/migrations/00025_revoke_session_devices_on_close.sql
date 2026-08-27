-- +goose Up
-- +goose StatementBegin

-- Closing a dining session now REVOKES its device credentials outright instead
-- of leaving them to expire on the read-grace window. REVOKED is a terminal
-- status distinct from REJECTED (staff declined a join at the gate): the device
-- was approved and seated, then the session ended.
ALTER TABLE session_devices
    DROP CONSTRAINT ck_session_devices_status;

ALTER TABLE session_devices
    ADD CONSTRAINT ck_session_devices_status
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED'));

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

-- Fold REVOKED rows back into REJECTED so the narrower constraint holds again.
UPDATE session_devices SET status = 'REJECTED' WHERE status = 'REVOKED';

ALTER TABLE session_devices
    DROP CONSTRAINT ck_session_devices_status;

ALTER TABLE session_devices
    ADD CONSTRAINT ck_session_devices_status
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'));

-- +goose StatementEnd
