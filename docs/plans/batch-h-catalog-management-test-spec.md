# Batch H Catalog Management — Test Spec

## Backend
- Admin reads:
  - `GET /api/v1/catalog/categories` is staff-JWT + `catalog.manage` gated.
  - `ListAdminMenuItems` calls repo admin method and returns hidden/unavailable/non-published rows; optional `category_id` forwarded.
  - HTTP `GET /api/v1/catalog/items` and `GET /api/v1/catalog/items/:id` are staff-JWT + `catalog.manage` gated; missing permission returns 403.
  - Admin item summary/detail DTOs include `version`, `status`, `is_featured`, `station`, and `display_order`; detail includes every editable field.
  - Guest `/api/v1/guest/menu/*` remains guest-filtered and unchanged.
- Commands:
  - Create validates required fields/category/price/publish `status` enum, creates item, returns `id,status,version`, writes outbox/audit.
  - Update validates `id` + `version`; stale version returns `conflict`; price change writes audit/outbox; returns new version.
  - Delete soft-deletes with version guard; stale version returns `conflict`; no physical delete.
  - Toggle requires the current `version`, updates `is_available` and optional `availability_status` only, bumps version, writes audit/outbox; stale version returns `conflict`; it never mutates publish `status`.
  - Create/update reject a category outside the current tenant.
  - Slug is derived from name plus a short item-id suffix; code is `MI-<uppercase short UUID>`; remaining unique violations map to `conflict`.
  - Every command writes a same-transaction `audit_logs` row with actor/action/entity/old/new values and one matching `catalog.*` outbox event.
- Repository:
  - Admin list excludes only `deleted_at`, not `status` or `availability_status`.
  - `GetItemAdmin` excludes only `deleted_at` for root item and still includes variants/options.

## Frontend
- `features/catalog` uses staff JWT through `apiRequest`; no guest ordering API reuse.
- `/admin/catalog` requires `catalog.manage`, loads categories and item cards with keys `['catalog','categories']` and `['catalog','items', categoryId]`.
- Category filter shows all items or selected category.
- Inline availability toggle asks for confirmation and invalidates item query after success.
- Create/edit sheet validates required fields including publish `status`, submits backend DTOs, includes optimistic version on update, and uses `SecureActionDialog` for price edit confirmation.
- Delete uses `SecureActionDialog` typed confirmation and passes current version.
- i18n strings exist for vi/en.

## Verification commands
- `rtk go test ./...` from `backend/`.
- `rtk npm run build` from `frontend/`.
- `rtk npm run lint` from `frontend/` if build passes.
