# SQL Draft - Cơ sở dữ liệu nhà hàng lẩu nướng, mỳ cay gọi món qua QR

> Phiên bản: Draft 2.0 — aligned with `AGENT_PROMPT.md`, `ARCHITECTURE.md`, and `README.md`.
> Hệ quản trị CSDL: PostgreSQL 15+.
> Migration source of truth: `../backend/migrations/00001_init_restaurant_schema.sql`.

## Fixes applied from review

1. **Money/VND**: all money columns use `BIGINT` with `_vnd` suffix. No `NUMERIC(12,2)` for currency.
2. **Statuses aligned to domain**:
   - dining session: `ACTIVE → AWAITING_PAYMENT → CLOSED`.
   - order item: `PENDING → ACKNOWLEDGED → PREPARING → READY → SERVED`; `CANCELLED` is terminal for cancellation.
3. **Multi-tenant**: tenant-owned rows carry `restaurant_id`, including orders, order items, kitchen tickets, invoices, payments, audit, notification, and outbox tables.
4. **Soft delete and optimistic lock**: mutable tables use `deleted_at` and `version`.
5. **Outbox**: uses `event_outbox` + `event_processing_log`, with a PostgreSQL `NOTIFY` trigger on insert.
6. **Payment webhook idempotency**: `payment_webhook_events` has unique `(restaurant_id, provider, event_id)`.
7. **Kitchen read/work queue**: `kitchen_tickets` exists, but `order_items.status` remains the source of truth for item lifecycle.
8. **One live session per table**: partial unique index blocks more than one `ACTIVE`/`AWAITING_PAYMENT` session per table.

## Full corrected migration

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(150) NOT NULL,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    address TEXT,
    phone VARCHAR(30),
    email VARCHAR(150),
    tax_code VARCHAR(50),
    logo_url VARCHAR(500),
    timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    vat_rate_basis_points INT NOT NULL DEFAULT 0,
    service_charge_basis_points INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    settings JSONB,
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_restaurants_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'))
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    username VARCHAR(80) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(30),
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    avatar_url VARCHAR(500),
    role_id UUID REFERENCES roles(id),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    last_login_at TIMESTAMPTZ,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_restaurant_username UNIQUE (restaurant_id, username),
    CONSTRAINT uq_users_restaurant_email UNIQUE (restaurant_id, email),
    CONSTRAINT uq_users_restaurant_phone UNIQUE (restaurant_id, phone),
    CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOCKED'))
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    device_info JSONB,
    ip_address VARCHAR(80),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE TABLE areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_areas_restaurant_name UNIQUE (restaurant_id, name)
);

CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    area_id UUID REFERENCES areas(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    capacity INT NOT NULL DEFAULT 4,
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    position_x INT,
    position_y INT,
    note TEXT,
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tables_restaurant_code UNIQUE (restaurant_id, code),
    CONSTRAINT chk_tables_status CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'INACTIVE'))
);

CREATE TABLE qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ,
    deactivated_by UUID REFERENCES users(id),
    deactivated_reason VARCHAR(255),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_qr_codes_one_active_per_table ON qr_codes(restaurant_id, table_id) WHERE is_active = TRUE AND deleted_at IS NULL;

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES categories(id),
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    icon VARCHAR(80),
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_categories_restaurant_slug UNIQUE (restaurant_id, slug)
);

CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id),
    code VARCHAR(80) NOT NULL,
    name VARCHAR(180) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    description TEXT,
    short_description VARCHAR(300),
    base_price_vnd BIGINT NOT NULL DEFAULT 0,
    cost_price_vnd BIGINT,
    image_url VARCHAR(500),
    images JSONB,
    preparation_time_minutes INT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    availability_status VARCHAR(40) NOT NULL DEFAULT 'AVAILABLE',
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_spicy BOOLEAN NOT NULL DEFAULT FALSE,
    tags JSONB,
    display_order INT NOT NULL DEFAULT 0,
    available_from TIME,
    available_to TIME,
    stock_quantity INT,
    station VARCHAR(30),
    status VARCHAR(30) NOT NULL DEFAULT 'PUBLISHED',
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_menu_items_restaurant_code UNIQUE (restaurant_id, code),
    CONSTRAINT uq_menu_items_restaurant_slug UNIQUE (restaurant_id, slug),
    CONSTRAINT chk_menu_items_availability_status CHECK (availability_status IN ('AVAILABLE', 'OUT_OF_STOCK', 'TEMPORARILY_UNAVAILABLE', 'HIDDEN')),
    CONSTRAINT chk_menu_items_station CHECK (station IS NULL OR station IN ('HOTPOT', 'GRILL', 'NOODLE', 'DRINK', 'DESSERT', 'GENERAL')),
    CONSTRAINT chk_menu_items_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);

CREATE TABLE menu_item_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    sku VARCHAR(80),
    unit VARCHAR(50),
    price_vnd BIGINT NOT NULL,
    cost_price_vnd BIGINT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_menu_item_variants_restaurant_sku UNIQUE (restaurant_id, sku)
);
CREATE UNIQUE INDEX uq_menu_item_variants_one_default ON menu_item_variants(restaurant_id, menu_item_id) WHERE is_default = TRUE AND deleted_at IS NULL;

CREATE TABLE option_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    selection_type VARCHAR(30) NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    min_selections INT NOT NULL DEFAULT 0,
    max_selections INT,
    display_order INT NOT NULL DEFAULT 0,
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_option_groups_selection_type CHECK (selection_type IN ('SINGLE', 'MULTIPLE')),
    CONSTRAINT chk_option_groups_selection_range CHECK (max_selections IS NULL OR max_selections >= min_selections)
);

CREATE TABLE options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    option_group_id UUID NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    price_delta_vnd BIGINT NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE menu_item_option_groups (
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    option_group_id UUID NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
    display_order INT NOT NULL DEFAULT 0,
    is_required_override BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (restaurant_id, menu_item_id, option_group_id)
);

CREATE TABLE dining_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tables(id),
    qr_code_id UUID REFERENCES qr_codes(id),
    session_code VARCHAR(80) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    customer_count INT,
    customer_name VARCHAR(150),
    customer_phone VARCHAR(30),
    note TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opened_by UUID REFERENCES users(id),
    closed_by UUID REFERENCES users(id),
    opened_via VARCHAR(30) NOT NULL DEFAULT 'QR_SCAN',
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dining_sessions_restaurant_code UNIQUE (restaurant_id, session_code),
    CONSTRAINT chk_dining_sessions_status CHECK (status IN ('ACTIVE', 'AWAITING_PAYMENT', 'CLOSED')),
    CONSTRAINT chk_dining_sessions_opened_via CHECK (opened_via IN ('QR_SCAN', 'STAFF', 'RESERVATION'))
);
CREATE UNIQUE INDEX uq_dining_sessions_one_open_per_table ON dining_sessions(restaurant_id, table_id) WHERE status IN ('ACTIVE', 'AWAITING_PAYMENT') AND deleted_at IS NULL;

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    dining_session_id UUID NOT NULL REFERENCES dining_sessions(id) ON DELETE CASCADE,
    order_number VARCHAR(80) NOT NULL,
    order_type VARCHAR(30) NOT NULL DEFAULT 'INITIAL',
    status VARCHAR(40) NOT NULL DEFAULT 'SUBMITTED',
    placed_by VARCHAR(30) NOT NULL DEFAULT 'GUEST',
    placed_by_user_id UUID REFERENCES users(id),
    note TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES users(id),
    cancelled_reason VARCHAR(255),
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_orders_restaurant_number UNIQUE (restaurant_id, order_number),
    CONSTRAINT chk_orders_order_type CHECK (order_type IN ('INITIAL', 'ADDITIONAL')),
    CONSTRAINT chk_orders_status CHECK (status IN ('SUBMITTED', 'CANCELLED')),
    CONSTRAINT chk_orders_placed_by CHECK (placed_by IN ('GUEST', 'STAFF'))
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    dining_session_id UUID NOT NULL REFERENCES dining_sessions(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES menu_items(id),
    menu_item_variant_id UUID REFERENCES menu_item_variants(id),
    item_name_snapshot VARCHAR(180) NOT NULL,
    item_code_snapshot VARCHAR(80),
    variant_name_snapshot VARCHAR(120),
    unit_price_vnd BIGINT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    options_total_vnd BIGINT NOT NULL DEFAULT 0,
    subtotal_vnd BIGINT NOT NULL DEFAULT 0,
    discount_amount_vnd BIGINT NOT NULL DEFAULT 0,
    total_amount_vnd BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    station VARCHAR(30),
    note TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES users(id),
    cancelled_reason VARCHAR(255),
    served_at TIMESTAMPTZ,
    served_by UUID REFERENCES users(id),
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_order_items_status CHECK (status IN ('PENDING', 'ACKNOWLEDGED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED')),
    CONSTRAINT chk_order_items_station CHECK (station IS NULL OR station IN ('HOTPOT', 'GRILL', 'NOODLE', 'DRINK', 'DESSERT', 'GENERAL'))
);

CREATE TABLE order_item_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    option_id UUID REFERENCES options(id),
    option_group_id UUID REFERENCES option_groups(id),
    option_name_snapshot VARCHAR(120) NOT NULL,
    option_group_name_snapshot VARCHAR(120) NOT NULL,
    price_delta_snapshot_vnd BIGINT NOT NULL DEFAULT 0,
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_order_item_options_quantity CHECK (quantity > 0)
);

CREATE TABLE order_item_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    from_status VARCHAR(40),
    to_status VARCHAR(40) NOT NULL,
    changed_by UUID REFERENCES users(id),
    changed_by_role VARCHAR(80),
    reason VARCHAR(255),
    note TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cancel_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    requested_by VARCHAR(30) NOT NULL DEFAULT 'GUEST',
    reason VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_cancel_requests_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE TABLE kitchen_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    dining_session_id UUID NOT NULL REFERENCES dining_sessions(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES tables(id),
    ticket_number VARCHAR(80) NOT NULL,
    station VARCHAR(30) NOT NULL,
    priority VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    acknowledged_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id),
    printed_at TIMESTAMPTZ,
    note TEXT,
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_kitchen_tickets_restaurant_number UNIQUE (restaurant_id, ticket_number),
    CONSTRAINT chk_kitchen_tickets_station CHECK (station IN ('HOTPOT', 'GRILL', 'NOODLE', 'DRINK', 'DESSERT', 'GENERAL')),
    CONSTRAINT chk_kitchen_tickets_priority CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    CONSTRAINT chk_kitchen_tickets_status CHECK (status IN ('PENDING', 'ACKNOWLEDGED', 'PREPARING', 'READY', 'CANCELLED'))
);

CREATE TABLE kitchen_ticket_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    kitchen_ticket_id UUID NOT NULL REFERENCES kitchen_tickets(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    started_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    prepared_by UUID REFERENCES users(id),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_kitchen_ticket_items_status CHECK (status IN ('PENDING', 'PREPARING', 'READY', 'CANCELLED'))
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    dining_session_id UUID NOT NULL REFERENCES dining_sessions(id),
    invoice_number VARCHAR(80) NOT NULL,
    invoice_type VARCHAR(30) NOT NULL DEFAULT 'STANDARD',
    status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    subtotal_vnd BIGINT NOT NULL DEFAULT 0,
    discount_amount_vnd BIGINT NOT NULL DEFAULT 0,
    discount_reason VARCHAR(255),
    service_charge_basis_points INT NOT NULL DEFAULT 0,
    service_charge_amount_vnd BIGINT NOT NULL DEFAULT 0,
    vat_basis_points INT NOT NULL DEFAULT 0,
    vat_amount_vnd BIGINT NOT NULL DEFAULT 0,
    rounding_amount_vnd BIGINT NOT NULL DEFAULT 0,
    total_amount_vnd BIGINT NOT NULL DEFAULT 0,
    paid_amount_vnd BIGINT NOT NULL DEFAULT 0,
    change_amount_vnd BIGINT NOT NULL DEFAULT 0,
    customer_info JSONB,
    note TEXT,
    issued_at TIMESTAMPTZ,
    issued_by UUID REFERENCES users(id),
    paid_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES users(id),
    voided_reason VARCHAR(255),
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_invoices_restaurant_number UNIQUE (restaurant_id, invoice_number),
    CONSTRAINT chk_invoices_invoice_type CHECK (invoice_type IN ('STANDARD', 'VAT')),
    CONSTRAINT chk_invoices_status CHECK (status IN ('DRAFT', 'PENDING', 'PAID', 'PARTIALLY_PAID', 'VOID', 'REFUNDED'))
);

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id),
    item_type VARCHAR(40) NOT NULL DEFAULT 'MENU_ITEM',
    name_snapshot VARCHAR(180) NOT NULL,
    description TEXT,
    unit_price_vnd BIGINT NOT NULL,
    quantity INT NOT NULL,
    subtotal_vnd BIGINT NOT NULL DEFAULT 0,
    discount_amount_vnd BIGINT NOT NULL DEFAULT 0,
    total_amount_vnd BIGINT NOT NULL DEFAULT 0,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_invoice_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_invoice_items_type CHECK (item_type IN ('MENU_ITEM', 'SERVICE_CHARGE', 'MANUAL_CHARGE', 'DISCOUNT'))
);

CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(40) NOT NULL,
    icon VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    requires_reference BOOLEAN NOT NULL DEFAULT FALSE,
    config JSONB,
    display_order INT NOT NULL DEFAULT 0,
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payment_methods_restaurant_code UNIQUE (restaurant_id, code),
    CONSTRAINT chk_payment_methods_type CHECK (type IN ('CASH', 'BANK_TRANSFER', 'CARD', 'E_WALLET', 'OTHER'))
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    dining_session_id UUID NOT NULL REFERENCES dining_sessions(id),
    payment_number VARCHAR(80) NOT NULL,
    payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
    amount_vnd BIGINT NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    gateway_transaction_id VARCHAR(150),
    transaction_data JSONB,
    reference_code VARCHAR(150),
    received_amount_vnd BIGINT,
    change_amount_vnd BIGINT NOT NULL DEFAULT 0,
    processed_at TIMESTAMPTZ,
    processed_by UUID REFERENCES users(id),
    refunded_at TIMESTAMPTZ,
    refunded_by UUID REFERENCES users(id),
    refunded_reason VARCHAR(255),
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payments_restaurant_number UNIQUE (restaurant_id, payment_number),
    CONSTRAINT uq_payments_gateway_transaction UNIQUE (restaurant_id, gateway_transaction_id),
    CONSTRAINT chk_payments_status CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED'))
);

CREATE TABLE payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    provider VARCHAR(80) NOT NULL,
    event_id VARCHAR(150) NOT NULL,
    payment_id UUID REFERENCES payments(id),
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payment_webhook_events_provider_event UNIQUE (restaurant_id, provider, event_id)
);

CREATE TABLE discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    code VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    type VARCHAR(40) NOT NULL,
    value_vnd BIGINT,
    percent_basis_points INT,
    min_order_amount_vnd BIGINT NOT NULL DEFAULT 0,
    max_discount_amount_vnd BIGINT,
    applies_to VARCHAR(40) NOT NULL DEFAULT 'INVOICE',
    target_ids JSONB,
    usage_limit INT,
    usage_limit_per_session INT,
    used_count INT NOT NULL DEFAULT 0,
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_discounts_restaurant_code UNIQUE (restaurant_id, code),
    CONSTRAINT chk_discounts_type CHECK (type IN ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_ITEM')),
    CONSTRAINT chk_discounts_applies_to CHECK (applies_to IN ('INVOICE', 'CATEGORY', 'MENU_ITEM'))
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    actor_type VARCHAR(30) NOT NULL DEFAULT 'USER',
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    ip_address VARCHAR(80),
    user_agent TEXT,
    trace_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_audit_logs_actor_type CHECK (actor_type IN ('USER', 'GUEST', 'SYSTEM'))
);

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

CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    key VARCHAR(120) NOT NULL,
    value JSONB NOT NULL,
    value_type VARCHAR(40) NOT NULL,
    category VARCHAR(80),
    description TEXT,
    is_editable BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID REFERENCES users(id),
    version INT NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_system_settings_restaurant_key UNIQUE (restaurant_id, key),
    CONSTRAINT chk_system_settings_value_type CHECK (value_type IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'ARRAY'))
);

CREATE TABLE event_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    aggregate_type VARCHAR(80) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_version VARCHAR(20) NOT NULL DEFAULT '1.0',
    payload JSONB NOT NULL,
    metadata JSONB,
    status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    priority SMALLINT NOT NULL DEFAULT 5,
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(100),
    lock_expires_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_event_outbox_status CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD'))
);

CREATE TABLE event_processing_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES event_outbox(id) ON DELETE CASCADE,
    handler_name VARCHAR(120) NOT NULL,
    status VARCHAR(40) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_ms INT,
    error_message TEXT,
    error_stack TEXT,
    attempt_number INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_event_processing_log_status CHECK (status IN ('SUCCESS', 'FAILED', 'SKIPPED'))
);

CREATE OR REPLACE FUNCTION notify_event_outbox() RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('event_outbox', NEW.id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_event_outbox_notify
AFTER INSERT ON event_outbox
FOR EACH ROW EXECUTE FUNCTION notify_event_outbox();

CREATE INDEX idx_users_restaurant_id ON users(restaurant_id);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_areas_restaurant_id ON areas(restaurant_id);
CREATE INDEX idx_tables_restaurant_id ON tables(restaurant_id);
CREATE INDEX idx_qr_codes_token ON qr_codes(token);
CREATE INDEX idx_categories_restaurant_id ON categories(restaurant_id);
CREATE INDEX idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX idx_menu_items_status_available ON menu_items(status, is_available, availability_status);
CREATE INDEX idx_menu_items_station ON menu_items(station);
CREATE INDEX idx_menu_item_variants_menu_item_id ON menu_item_variants(menu_item_id);
CREATE INDEX idx_option_groups_restaurant_id ON option_groups(restaurant_id);
CREATE INDEX idx_options_option_group_id ON options(option_group_id);
CREATE INDEX idx_dining_sessions_restaurant_table ON dining_sessions(restaurant_id, table_id);
CREATE INDEX idx_dining_sessions_status ON dining_sessions(status);
CREATE INDEX idx_orders_restaurant_session ON orders(restaurant_id, dining_session_id);
CREATE INDEX idx_order_items_restaurant_session ON order_items(restaurant_id, dining_session_id);
CREATE INDEX idx_order_items_status_station ON order_items(status, station);
CREATE INDEX idx_order_item_options_order_item_id ON order_item_options(order_item_id);
CREATE INDEX idx_order_item_status_history_order_item_id ON order_item_status_history(order_item_id);
CREATE INDEX idx_cancel_requests_order_item_id ON cancel_requests(order_item_id);
CREATE INDEX idx_kitchen_tickets_station_status ON kitchen_tickets(restaurant_id, station, status);
CREATE INDEX idx_kitchen_ticket_items_ticket_id ON kitchen_ticket_items(kitchen_ticket_id);
CREATE INDEX idx_invoices_restaurant_session ON invoices(restaurant_id, dining_session_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX idx_payments_restaurant_invoice ON payments(restaurant_id, invoice_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payment_webhook_events_payment_id ON payment_webhook_events(payment_id);
CREATE INDEX idx_audit_logs_restaurant_id ON audit_logs(restaurant_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_event_outbox_status_available ON event_outbox(status, available_at, priority);
CREATE INDEX idx_event_outbox_aggregate ON event_outbox(aggregate_type, aggregate_id);

INSERT INTO roles (name, display_name, description, is_system) VALUES
('manager', 'Quản lý', 'Quản lý nhà hàng, thực đơn, báo cáo', TRUE),
('cashier', 'Thu ngân', 'Lập hóa đơn và xử lý thanh toán', TRUE),
('server', 'Phục vụ', 'Theo dõi bàn và phục vụ món', TRUE),
('kitchen', 'Bếp', 'Tiếp nhận và cập nhật trạng thái món', TRUE)
ON CONFLICT (name) DO NOTHING;

```

## Notes for implementation

- Repositories must always scope by `restaurant_id`.
- Application services must write domain changes and `event_outbox` rows in the same transaction.
- Guest-facing APIs should not expose prices/running totals even though order/invoice snapshots are stored.
- The migration is intentionally initial-schema style. Later production migration history should split it by module.
