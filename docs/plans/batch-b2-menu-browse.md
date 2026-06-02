# Batch B2 — Guest menu browse (token-gated) (codex implementation spec)

Status: **ready for codex**. Depends on **Batch B1** (merged): guest group + `auth.QRSessionToken`
middleware + `tenant.MustRestaurantID` injection. This file is the implementation
spec for codex and the review rubric for the reviewer.

## 0. Scope

Stories: **US-012** (browse categories), **US-013** (browse items),
**US-014** (item detail: variants + options + selection limits).

All three are **guest reads behind the B1 session-token middleware**. Tenant comes
from the guest session context (`tenant.MustRestaurantID`) — same convention as staff,
no special-casing. No new security primitive; this batch consumes B1's.

Out of scope (do NOT touch):
- Catalog **write** use-cases (`create/update/delete-menu-item`, `toggle-availability`)
  AND their existing generic `Input`/`Output` + reflection `handle()` glue. Leave that
  staff handler exactly as-is — a separate later batch refactors writes to per-use-case
  DTOs. **B2 only ADDS read use-cases + a new read handler method.**
- Ordering/kitchen/billing.
- No migration. All required tables already exist in `00001`.

## 1. Conventions (reuse A/B1 — do not reinvent)

- **Per-use-case DTOs** + direct handler binding. New read use-cases each get their own
  request/response structs. Bind errors (query/path parse) → `apperr.CodeInvalid` (→400).
- **Tenant from context**: `tenant.MustRestaurantID(ctx)` — the guest group's
  `QRSessionToken` middleware already injected it. Never read a restaurant_id from the
  request for guest reads.
- **Repos through `postgres.QuerierFromContext(ctx, r.pool)`** (same `q(ctx)` helper as
  dining/identity repos). The catalog repo currently has NO `q` helper (both methods are
  stubs) — add one: `func (r *Repository) q(ctx context.Context) pg.Querier { return pg.QuerierFromContext(ctx, r.pool) }`.
- **PINNED — reads run OUTSIDE `tx.Run`.** Unlike A/B1 write use-cases, B2 reads are
  read-only and do NOT wrap in `tx.Run`; they call repo methods directly (the repo's
  `q(ctx)` returns the pool when no tx is in context). This is a deliberate convention
  divergence for read paths — the reviewer must NOT flag the missing tx wrapper.

## 2. Routes — guest group, GET verbs

Mount under the **existing guest group** built in B1's `cmd/api/main.go`. B1 left it as
`_ = api.Group("/guest", auth.QRSessionToken(diningRepo))` (dead — group discarded). B2
makes it live:

- main.go: change that line to `guestGroup := api.Group("/guest", auth.QRSessionToken(diningRepo))`.
- Add a **new** catalog handler method `RegisterGuestRoutes(g *gin.RouterGroup)` —
  **no `secret` param, no `auth.JWT`, no `auth.RBAC`**. The group already carries
  `QRSessionToken`; **codex must NOT re-apply any auth middleware inside it.** (This is a
  different signature from the staff `RegisterRoutes(r, secret)` — keep both.)
- main.go calls `catalogHandler.RegisterGuestRoutes(guestGroup)`.
- No module import cycle: the group is constructed in `main`, dining provides the
  validator, catalog provides the route registration. **catalog must NOT import dining.**

Endpoints (all GET, all tenant-scoped from session):
- `GET /api/v1/guest/menu/categories` — US-012.
- `GET /api/v1/guest/menu/items` — US-013. Optional query `?category_id=<uuid>` filter.
- `GET /api/v1/guest/menu/items/:id` — US-014 detail.

## 3. Visibility predicates (READ THIS — #1 is a security/leak pin)

**Items (US-013 list & US-014 detail) — EXACT predicate:**
```
restaurant_id = $tenant
  AND status = 'PUBLISHED'
  AND availability_status <> 'HIDDEN'
  AND deleted_at IS NULL
```
- `availability_status` enum is AVAILABLE / OUT_OF_STOCK / TEMPORARILY_UNAVAILABLE / HIDDEN.
  `OUT_OF_STOCK` and `TEMPORARILY_UNAVAILABLE` items **stay listed** (frontend greys them
  via the availability field) — that is the "availability" US-013/014 want.
  **`HIDDEN` and non-PUBLISHED (DRAFT/ARCHIVED) items MUST NOT appear.** Omitting the
  `availability_status <> 'HIDDEN'` clause leaks hidden items — do not miss it.

**Categories (US-012):** `restaurant_id = $tenant AND is_active = TRUE AND deleted_at IS NULL`,
ordered by `display_order, name`.
- **PINNED — flat list.** `categories.parent_id` exists (self-FK, nesting possible) but
  B2 returns a FLAT list ordered by `display_order`; ignore `parent_id`. Hierarchy is a
  later concern.

**Variants:** `menu_item_variants` where `deleted_at IS NULL`, ordered `display_order`.
**Option groups / options:** join `menu_item_option_groups` → `option_groups`
(`deleted_at IS NULL`), and `options` where `deleted_at IS NULL`, ordered `display_order`.

**PINNED — empty menu = `200` with `[]`** (or empty arrays in the payload), NOT 404. An
empty/unpublished menu is a normal state, like B1's `not_opened`.

## 4. IDOR / cross-tenant pin (security — reinforced in §9)

`GET /guest/menu/items/:id` MUST filter `restaurant_id = $tenant AND id = $param` in the
SAME query. A valid item id from a DIFFERENT restaurant → **404** (not 403, no body leak).
Guests must never read another restaurant's menu. Same scoping on every variant/option
query (all carry `restaurant_id`). This is the headline security item for B2.

## 5. US-012 — Categories

Use-case `ListCategories` → `[]CategoryDTO{ ID, Name, Slug, Description, ImageURL, Icon, DisplayOrder }`.
Single query, predicate per §3. Returns `200 []` when none.

## 6. US-013 — Item list (with variant SUMMARY, not full payload)

Use-case `ListMenuItems(req{CategoryID *uuid.UUID})`. Predicate per §3, plus
`AND category_id = $2` when `category_id` query param present (validate as uuid → 400 on
bad format). Order `display_order, name`.

**PINNED — list returns a SUMMARY only (avoid N+1):**
```
MenuItemSummaryDTO {
  ID, CategoryID, Name, Slug, ShortDescription, ImageURL
  BasePriceVND   int64   // menu_items.base_price_vnd
  AvailabilityStatus string  // so client greys OUT_OF_STOCK etc.
  IsAvailable    bool
  HasVariants    bool
  PriceFromVND   *int64  // when HasVariants: MIN(price_vnd) over available variants; else nil
}
```
- **Do NOT load full variants/options per item in the list** — that is the detail
  endpoint's job. Compute `HasVariants` + `PriceFromVND` with a single aggregate
  join/subquery over `menu_item_variants` (`is_available = TRUE AND deleted_at IS NULL`),
  NOT a per-item loop.
- **Pricing note for codex:** `menu_item_variants.price_vnd` is an **absolute** price
  (not a delta). `options.price_delta_vnd` IS a delta. Do not conflate. `PriceFromVND` =
  MIN absolute variant price.

## 7. US-014 — Item detail (full variants + option groups + options + limits)

Use-case `GetMenuItem(req{ItemID uuid.UUID})`. Steps (all §3/§4 scoped):
1. Fetch the item (predicate §3 + id, §4 scoping) → not found → 404.
2. Fetch its variants (one query).
3. Fetch its option groups via `menu_item_option_groups` join `option_groups` (one query).
4. Fetch ALL options for those groups in **ONE** query
   `WHERE option_group_id = ANY($1) AND deleted_at IS NULL` — **PINNED, no per-group loop
   (no N+1).** Group them in Go by `option_group_id`.

Response:
```
MenuItemDetailDTO {
  ID, CategoryID, Name, Slug, Description, ShortDescription, ImageURL
  Images        []string  // menu_items.images JSONB
  BasePriceVND  int64
  AvailabilityStatus string
  IsAvailable   bool
  IsSpicy       bool
  Variants      []VariantDTO       // ID, Name, Unit, PriceVND(absolute), IsDefault, IsAvailable, DisplayOrder
  OptionGroups  []OptionGroupDTO
}
OptionGroupDTO {
  ID, Name, Description
  SelectionType string   // SINGLE | MULTIPLE
  IsRequired    bool     // see override pin
  MinSelections int
  MaxSelections *int      // nullable in schema
  DisplayOrder  int
  Options       []OptionDTO  // ID, Name, PriceDeltaVND, IsDefault, IsAvailable, DisplayOrder
}
```
- **PINNED — `is_required` override:** effective required =
  `COALESCE(menu_item_option_groups.is_required_override, option_groups.is_required)`.
  The per-item override wins when non-null; else the group default.

## 8. Catalog domain / repo work

- `catalog/domain/model.go`: add read models or keep DTOs in the application layer — your
  call, but do NOT alter the existing `MenuItem`/`MenuRepository` write contract (those
  back the untouched write stubs). Cleanest: define a `MenuReadRepository` interface for
  the new read methods rather than extending the existing `MenuRepository`:
  - `ListCategories(ctx, restaurantID) ([]Category, error)`
  - `ListItems(ctx, restaurantID, categoryID *uuid.UUID) ([]MenuItemSummary, error)`
  - `GetItem(ctx, restaurantID, itemID) (*MenuItemDetail, error)` (item + variants + groups + options assembled in the repo, or split into the queries above and assembled in the use-case — keep N+1 pins of §6/§7 either way).
- Implement the real SQL in `catalog/infrastructure/postgres/catalog_repository.go`
  (add the `q(ctx)` helper). Leave the existing stubbed `Save`/`Get` as-is.

## 9. Tests
Mirror A/B1 style (testify; faked read-repo for use-cases; `httptest` + `gin.TestMode`
for handlers). Cover:
- categories: returns active ordered list; empty → `200 []`.
- items list: PUBLISHED+non-HIDDEN only (assert a HIDDEN and a DRAFT row are excluded);
  `category_id` filter applied; bad `category_id` → 400; `HasVariants`/`PriceFromVND`
  populated from variants; empty → `200 []`.
- item detail: full variants + groups + options; `is_required_override` beats group
  default; options grouped correctly; cross-tenant id → **404**; unknown id → 404;
  HIDDEN/DRAFT id → 404.
- handler/middleware: a request WITHOUT a valid `X-Session-Token` to a `/guest/menu/*`
  route → 401 (the B1 middleware fires — assert the guest group actually carries it).
- Suite stays green: `go build ./... && go vet ./... && go test ./...`.

## 10. Review rubric
- [ ] Guest group made live in main.go (`guestGroup :=`, B1's `_ =` dead line replaced);
      catalog `RegisterGuestRoutes(g)` added with NO `secret`/JWT/RBAC re-applied; staff
      `RegisterRoutes` untouched; **catalog does not import dining**; no import cycle.
- [ ] Item predicate EXACT: `status='PUBLISHED' AND availability_status<>'HIDDEN' AND
      deleted_at IS NULL` + tenant. HIDDEN/DRAFT/ARCHIVED never returned (list or detail).
- [ ] **IDOR:** detail query filters `restaurant_id=$tenant AND id=$param`; cross-tenant
      → 404, no leak. All variant/option queries restaurant/ownership scoped.
- [ ] Categories flat (parent_id ignored), `is_active` + not deleted, ordered.
- [ ] List = summary only; `HasVariants`/`PriceFromVND` via single aggregate, NO per-item
      variant loop; variant price treated as ABSOLUTE.
- [ ] Detail: options for all groups in ONE `= ANY(...)` query (no N+1);
      `is_required` = COALESCE(override, group default).
- [ ] Reads run OUTSIDE `tx.Run` (pinned convention — not a defect); repo uses
      `QuerierFromContext`; tenant from `MustRestaurantID`, never from request.
- [ ] Empty menu → `200 []`, not 404. Bad `category_id` → 400.
- [ ] `available_from`/`available_to` time windows DEFERRED (documented, not honored).
- [ ] Catalog write stubs + generic glue untouched. Tests per §9. build/vet/test green.

## 11. Deferred (stated, not silently dropped)
- **Time-of-day availability** (`available_from`/`available_to`): B2 ignores; shows all
  PUBLISHED non-HIDDEN regardless of clock. Needs restaurant-tz logic — later batch.
- **Category hierarchy** (`parent_id`): flat for now.
- **i18n / translations, tags, featured sort**: not in US-012/013/014 acceptance — skip.

## 12. After B2 → Batch C preview
Ordering: guest places order against `guest.SessionFromContext` (session_id/table_id from
B1's middleware), items validated against this menu. Separate handoff.
