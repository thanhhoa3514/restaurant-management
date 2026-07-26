-- +goose Up
-- +goose StatementBegin

INSERT INTO payment_methods (
    restaurant_id,
    code,
    name,
    type,
    is_active,
    requires_reference,
    display_order
)
SELECT
    id,
    'sepay',
    'SePay VietQR',
    'BANK_TRANSFER',
    TRUE,
    FALSE,
    3
FROM restaurants
WHERE deleted_at IS NULL
ON CONFLICT (restaurant_id, code) DO UPDATE
SET name = EXCLUDED.name,
    type = EXCLUDED.type,
    is_active = TRUE,
    requires_reference = FALSE,
    display_order = EXCLUDED.display_order,
    deleted_at = NULL,
    updated_at = NOW();

UPDATE payment_methods
SET is_active = FALSE,
    updated_at = NOW()
WHERE code = 'momo'
  AND deleted_at IS NULL;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

UPDATE payment_methods
SET is_active = FALSE,
    updated_at = NOW()
WHERE code = 'sepay'
  AND deleted_at IS NULL;

UPDATE payment_methods
SET is_active = TRUE,
    updated_at = NOW()
WHERE code = 'momo'
  AND deleted_at IS NULL;

-- +goose StatementEnd
