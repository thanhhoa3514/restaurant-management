-- +goose Up
-- +goose StatementBegin

-- Combo meals (set menus): a fixed-price bundle of dishes that fans out across
-- kitchen stations at order time. Definitions ("what's in the combo") live in
-- these two tables and are a catalog concern; the ordering-time fan-out into a
-- parent + component order_items is handled in the ordering application layer.

CREATE TABLE combos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id       UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    code                VARCHAR(80) NOT NULL,           -- e.g. COMBO-NUONG-4
    name                VARCHAR(180) NOT NULL,          -- "Set Nướng nhóm 4"
    slug                VARCHAR(200) NOT NULL,
    description         TEXT,
    image_url           VARCHAR(500),
    combo_price_vnd     BIGINT NOT NULL DEFAULT 0,      -- fixed bundle price (VND int64)
    status              VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    availability_status VARCHAR(40) NOT NULL DEFAULT 'AVAILABLE',
    is_featured         BOOLEAN NOT NULL DEFAULT FALSE,
    valid_from          TIMESTAMPTZ,                    -- nullable; NULL = always live
    valid_to            TIMESTAMPTZ,                    -- nullable; NULL = always (holiday windows)
    display_order       INT NOT NULL DEFAULT 0,
    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id),
    version             INT NOT NULL DEFAULT 1,
    deleted_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_combos_restaurant_code UNIQUE (restaurant_id, code),
    CONSTRAINT uq_combos_restaurant_slug UNIQUE (restaurant_id, slug),
    CONSTRAINT chk_combos_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    CONSTRAINT chk_combos_availability_status CHECK (availability_status IN ('AVAILABLE', 'OUT_OF_STOCK', 'TEMPORARILY_UNAVAILABLE', 'HIDDEN'))
);

CREATE INDEX idx_combos_restaurant_id ON combos(restaurant_id);
CREATE INDEX idx_combos_status_available ON combos(status, availability_status);

-- combo_items = the combo definition's components (which dish, which variant, how many).
CREATE TABLE combo_items (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id        UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    combo_id             UUID NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
    menu_item_id         UUID NOT NULL REFERENCES menu_items(id),
    menu_item_variant_id UUID REFERENCES menu_item_variants(id),  -- nullable; pins a variant
    quantity             INT NOT NULL DEFAULT 1,
    display_order        INT NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_combo_items_quantity CHECK (quantity > 0)
);

CREATE INDEX idx_combo_items_combo ON combo_items(restaurant_id, combo_id);

-- Parent/child link on order_items. All three columns nullable → plain
-- à-la-carte lines keep both NULL and are completely unchanged.
--   parent combo line: combo_id set, parent_order_item_id NULL, menu_item_id NULL,
--                      unit_price_vnd = combo_price, station NULL, reference_price_vnd = Σ à-la-carte
--   component line:    parent_order_item_id set, menu_item_id set, unit_price_vnd = 0, real station
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS combo_id UUID REFERENCES combos(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS parent_order_item_id UUID REFERENCES order_items(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS reference_price_vnd BIGINT;

CREATE INDEX idx_order_items_parent ON order_items(parent_order_item_id);

-- invoice_items mirrors order_items: parent invoice line carries combo_id +
-- reference_price_vnd (frozen à-la-carte total for the savings caption);
-- component sub-lines carry parent_invoice_item_id. item_type distinguishes them.
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS combo_id UUID REFERENCES combos(id);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS parent_invoice_item_id UUID REFERENCES invoice_items(id);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS reference_price_vnd BIGINT;

ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS chk_invoice_items_type;
ALTER TABLE invoice_items ADD CONSTRAINT chk_invoice_items_type
    CHECK (item_type IN ('MENU_ITEM', 'COMBO', 'COMBO_COMPONENT', 'SERVICE_CHARGE', 'MANUAL_CHARGE', 'DISCOUNT'));

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS chk_invoice_items_type;
ALTER TABLE invoice_items ADD CONSTRAINT chk_invoice_items_type
    CHECK (item_type IN ('MENU_ITEM', 'SERVICE_CHARGE', 'MANUAL_CHARGE', 'DISCOUNT'));

ALTER TABLE invoice_items DROP COLUMN IF EXISTS reference_price_vnd;
ALTER TABLE invoice_items DROP COLUMN IF EXISTS parent_invoice_item_id;
ALTER TABLE invoice_items DROP COLUMN IF EXISTS combo_id;

DROP INDEX IF EXISTS idx_order_items_parent;
ALTER TABLE order_items DROP COLUMN IF EXISTS reference_price_vnd;
ALTER TABLE order_items DROP COLUMN IF EXISTS parent_order_item_id;
ALTER TABLE order_items DROP COLUMN IF EXISTS combo_id;

DROP TABLE IF EXISTS combo_items;
DROP TABLE IF EXISTS combos;

-- +goose StatementEnd
