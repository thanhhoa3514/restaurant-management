# Batch H — Catalog (Menu) Management

**Status:** Spec (no code yet)
**Author:** Claude (spec), codex (backend impl), thanhhoa3514 (vision + review)
**Date:** 2026-06-08
**Phase:** Admin nav Phase 2 (manage surface) — see `permission-tree-shell.md`
addendum (operate/manage split).

## Goal

Turn the `/admin/catalog` placeholder (`ComingSoon`) into a real menu
management screen: list dishes by category, toggle availability inline,
create / edit / delete dishes. Gated by `catalog.manage`.

## Why catalog (not staff) for Phase 2

We originally said "staff first." That was wrong — `features/staff` is the
**operational** data layer (tables/sessions/kitchen tickets), unrelated to
employee management, and the backend `identity.manage-users` is an explicit
stub with no list endpoint. Catalog is the cheaper *and* more valuable
admin surface (daily price edits, hiding sold-out dishes). It also becomes
the CRUD-screen pattern for reports/settings/staff later.

---

## Current backend state (verified 2026-06-08)

Module `catalog` over a complete schema (`migrations/00001`, `menu_items`).

**Implemented (read):**
- `ListCategories`, `ListMenuItems`, `GetMenuItem` — real repo queries.
- DTO `MenuItemSummaryDTO` (list_menu_items.go): `id, category_id, name,
  slug, short_description, image_url, base_price_vnd, availability_status,
  is_available, has_variants, price_from_vnd`.

**Stubbed (write) — return `apperr.ErrNotImplemented`:**
- `CreateMenuItem`, `UpdateMenuItem`, `DeleteMenuItem`, `ToggleAvailability`.
- Shared placeholder DTOs in `dto.go`: `Input{RestaurantID}`,
  `Output{ID, Status}` — real fields NOT defined yet.

**Routing (handler.go):**
- `RegisterRoutes` → group `/catalog` gated `catalog.manage`: the 4 write
  POSTs only. **No admin-gated GET.**
- `RegisterGuestRoutes` → `/menu/{categories,items,items/:id}` under the
  guest session-token group.

**THE READ GAP:** `Repository.ListItems` filters
`status='PUBLISHED' AND availability_status <> 'HIDDEN' AND deleted_at IS NULL`
— correct for guests, wrong for admin. Admin must see HIDDEN / non-published
/ unavailable items. And the read routes sit under guest auth, so a staff
JWT can't call them. → **Add admin-gated read endpoints under `/catalog`.**

`menu_items` columns available: `code, name, slug, description,
short_description, base_price_vnd, cost_price_vnd, image_url, images(JSONB),
preparation_time_minutes, is_available, availability_status, is_featured,
is_spicy, tags(JSONB), display_order, available_from/to, stock_quantity,
station, status, created_by, updated_by, version, deleted_at`.
Related: `categories`, item variants table, `item_options`
(`domain.ItemOption{Name, PriceDeltaVND}`).

---

## Scope

### MVP (this batch)
Item-level CRUD on the core fields + availability toggle. **Variants and
options are read-only display this batch** (their editors are a follow-up) —
keeps scope bounded.

Editable fields: `category_id, name, description, short_description,
base_price_vnd, image_url, is_available, availability_status, status,
is_featured, is_spicy, station, display_order`. Server owns `slug` (from name),
`code`, `version`, `created_by/updated_by`, timestamps. `status` controls
publish lifecycle (`DRAFT|PUBLISHED|ARCHIVED`); `availability_status` controls
sellability/display (`AVAILABLE|OUT_OF_STOCK|TEMPORARILY_UNAVAILABLE|HIDDEN`).

### Out of scope (later sub-phases)
- Variant / option group editors (create/edit nested rows).
- Category CRUD (assume categories exist; this batch only assigns to them).
- Bulk import, image upload pipeline (use URL field for now).
- Cost/margin reporting (belongs to `/admin/reports`).

---

## Backend tasks (codex implements, Claude reviews)

> INVARIANT: every endpoint keeps its server-side `catalog.manage` gate.
> The frontend permission tree is presentation-only.

1. **Admin read endpoints** under `RegisterRoutes` (`catalog.manage` group):
   - `GET /catalog/categories` — active, non-deleted categories for the
     restaurant. This is staff-JWT authenticated; the frontend must not call
     the guest category endpoint.
   - `GET /catalog/items` — full set incl. HIDDEN/unpublished/unavailable,
     **excludes** `deleted_at IS NOT NULL`. Optional `?category_id=`. Reuse
     the guest projection logic but expose a separate
     `AdminMenuItemSummaryDTO` via a new repo method (e.g. `ListItemsAdmin`)
     without the guest `PUBLISHED`/`HIDDEN` filter. The admin DTO also includes
     `status, is_featured, station, display_order, version`.
   - `GET /catalog/items/:id` — full detail incl. variants/options for the
     edit form. Use `AdminMenuItemDetailDTO`, including all editable fields,
     `status`, and `version`. (Admin variant of `GetMenuItem`.)
   - Keep guest `/menu/*` untouched.
2. **Define real command DTOs** (replace placeholder `Input`/`Output`, or add
   per-command request structs — match the project's command pattern):
   - `CreateMenuItemRequest`: editable fields above (+ `RestaurantID` from
     tenant ctx, `created_by` from JWT actor).
   - `UpdateMenuItemRequest`: `id` + editable fields + `version` for optimistic
     concurrency (table has `version`); reject on stale version.
   - `DeleteMenuItemRequest`: `id` (+ `version`). **Soft delete** (`deleted_at`),
     not physical — FK from order line snapshots must stay intact.
   - `ToggleAvailabilityRequest`: `id`, `is_available`, optional
     `availability_status`, and `version`; reject stale toggles. This command
     must not mutate publish `status`.
3. **Implement the 4 stub `Handle` bodies**: validate → domain mutation →
   repo write → outbox event (pattern mirrors other shipped command handlers,
   e.g. dining `manage_table_qr`). Bump `version`, set `updated_by`.
   Use explicit command-repository methods shaped to the SQL mutation:
   `CreateItem`, `UpdateItem`, `SoftDeleteItem`, `ToggleAvailability`,
   `GetItemForUpdate`, and `CategoryExists`. Do not force these writes through
   the currently incomplete generic `MenuItem.Save/Get` aggregate boundary.
   Create/update must verify the category belongs to the current tenant.
4. **Server-owned identifiers:** slugify the name and append a short item UUID
   suffix so the tenant slug is stable and collision-resistant; generate code
   as `MI-<uppercase short UUID>`. Translate any remaining unique violation to
   `conflict`.
5. **Audit logging** for create/update/delete/toggle (high-impact — see
   `high-impact-action-policy` memory). Actor = JWT user id. Write the
   `audit_logs` row directly inside the same database transaction as the
   command, with action
   `catalog.item_created|catalog.item_updated|catalog.item_deleted|catalog.item_availability_toggled`,
   entity type `menu_item`, old/new values, IP/user-agent metadata when
   supplied by the HTTP handler. Also emit outbox events
   `catalog.item_created|catalog.item_updated|catalog.item_deleted|catalog.item_availability_toggled`
   for realtime
   invalidation.
6. Tests: repo read (admin includes hidden), admin categories/items permission
   gates, admin DTO version/admin fields, each command happy + stale-version
   (including toggle) + audit/outbox write + slug/code collision path.

---

## Frontend tasks

New feature module `features/catalog` (do NOT reuse guest `ordering` api —
that's session-token + guest-filtered).

1. **`features/catalog/api.ts`** — staff-JWT calls via `apiRequest`:
   `listAdminCategories()`, `listAdminMenuItems(categoryId?)`,
   `getAdminMenuItem(id)`, `createMenuItem(body)`, `updateMenuItem(body)`,
   `deleteMenuItem(id, version)`,
   `toggleAvailability(id, isAvailable, version, availabilityStatus?)`. The
   toggle call must send the card/detail's current `version` and
   invalidate/refetch item queries after success so the next mutation uses the
   returned/current version.
2. **`features/catalog/types.ts`** — mirror the DTOs above.
3. **Screen** — replace `ComingSoon` in `routes/admin.catalog.tsx`:
   - Category sidebar/tabs + item grid (cards show name, price, availability
     badge, hidden/featured tags). Show unavailable/hidden items dimmed.
   - **Inline availability toggle** per card (optimistic, React Query
     invalidate `['catalog','items']`).
   - **Create / Edit** in a right `Sheet` (reuse `admin.table-qrs.tsx`
     pattern + `useShellConfig`/`ShellHeaderCenter`).
     On edit, compare the submitted `base_price_vnd` with the loaded original;
     intercept a changed price with `SecureActionDialog`, then submit with the
     loaded `version`.
   - **Delete** via `SecureActionDialog` (high-impact, require typed
     confirmation — same as QR rotate).
4. **i18n** — page copy in `features/admin/data/i18n.ts` (chrome strings
   already in `shell-i18n.ts`). Bilingual vi/en.
5. React Query keys: `['catalog','categories']`, `['catalog','items', categoryId]`.

---

## RBAC / high-impact

- Route already gated `catalog.manage` (`admin.catalog.tsx` beforeLoad) +
  server gate. Both mandatory.
- Price change + delete + availability toggle are system-influencing →
  confirm-gate UI + audit log per `high-impact-action-policy`. Delete and
  price edit use `SecureActionDialog`; toggle can be a lighter confirm.

## Build order

1. Backend admin read endpoint + `ListItemsAdmin` repo (unblocks the whole UI).
2. Backend command DTOs + 4 `Handle` impls + audit + tests.
3. Frontend `features/catalog` api + types.
4. Frontend screen: list + toggle (read+toggle first, demoable).
5. Frontend create/edit sheet + delete dialog.
6. Review (Claude) → then variants/options editor as a follow-up batch.
