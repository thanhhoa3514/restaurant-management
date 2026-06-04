# Batch C1 — Guest order placement & view (codex implementation spec)

Status: **ready for codex**. Depends on **B1** (guest session middleware + `guest.SessionFromContext`
+ `tenant.MustRestaurantID`) and **B2** (menu tables, orderability semantics). This file is
the implementation spec for codex and the review rubric for the reviewer.

## 0. Batch C split (context)

Ordering (EPIC-04/05) is split across handoffs:
- **C1 = guest places & views orders (THIS FILE)** — US-020, US-021, US-022, US-023,
  US-030 (snapshots), US-033 (block when not ACTIVE).
- **C2** = guest pending cancel/edit + cancel-request (US-024/025/026) — after C1.
- **D** = kitchen (EPIC-06: US-031 transitions, US-032 history, US-034-039) — separate.
- **E** = realtime broadcasts + staff-call (US-027/028/034) — separate.
- US-029 request-payment (session→AWAITING_PAYMENT) handled with billing/F; C1 only
  *enforces* the block, does not create the transition.

## 1. Scope (C1)

Two guest endpoints behind B1's session-token middleware, mounted on the shared
`guestGroup` (same place B2 mounted menu reads):
- `POST /api/v1/guest/orders` — place an order (US-020 first / US-021 additional).
- `GET  /api/v1/guest/orders` — view all submitted items for the session (US-023).

Out of scope (do NOT touch): the staff `/ordering` routes + their generic `Input`/`Output`
+ reflection `handle()` glue (left exactly as-is, like catalog writes); kitchen routes
(stay `ErrNotImplemented`); the existing `allowedTransitions`/status consts in
`ordering/domain/model.go` (that's D — leave them). No status-transition use-cases here.

No migration — all tables exist in `00001` (`orders`, `order_items`,
`order_item_options`, `kitchen_tickets`, `kitchen_ticket_items`).

## 2. Conventions (reuse A/B1/B2 — do not reinvent)

- **Per-use-case DTOs** + direct handler binding; bind/parse errors → `apperr.CodeInvalid`
  (→400). No reflection glue for the new guest endpoints.
- **Guest tenant + session from context**: `tenant.MustRestaurantID(ctx)` and
  `guest.SessionFromContext(ctx)` (gives `SessionID`, `TableID`) — both injected by B1's
  `QRSessionToken` middleware. NEVER take session_id/restaurant_id/table_id from the
  request body.
- **Place-order runs INSIDE `tx.Run`** (multi-table write — orders + items + options +
  tickets must be atomic). **View runs OUTSIDE `tx.Run`** (read-only, per B2 convention).
- Repo through `postgres.QuerierFromContext`. Add the `q(ctx)` helper to the ordering repo.
- **Modular-monolith data access (pinned):** the ordering repo queries the catalog tables
  (`menu_items`, `menu_item_variants`, `menu_item_option_groups`, `option_groups`,
  `options`) **directly via SQL** for validation + snapshotting. Do NOT import the catalog
  module. This duplicates menu-table knowledge across modules — **accepted** for the MVP
  (matches B1's dining repo reading `qr_codes`/`tables` directly).
- New work mirrors how B2 added a read repo alongside untouched writes: add ordering
  **write/read models + a placement repo** without altering the existing
  `OrderRepository{Save,Get}` write contract or its stubs.

## 3. Orderability predicate (PINNED — STRICTER than B2 browse)

B2 browse showed OUT_OF_STOCK items (greyed). **Ordering must NOT.** A menu item is
**orderable** only when:
```
restaurant_id = $tenant
  AND status = 'PUBLISHED'
  AND is_available = TRUE
  AND availability_status = 'AVAILABLE'
  AND deleted_at IS NULL
```
Do NOT copy B2's `availability_status <> 'HIDDEN'` browse predicate here — that would let
OUT_OF_STOCK / TEMPORARILY_UNAVAILABLE items be ordered (US-019/022 violation). A line
referencing a non-orderable item → per-line `unavailable` error (§6).

Variants: must belong to the item, `is_available = TRUE`, `deleted_at IS NULL`.
Options: must belong (via `menu_item_option_groups`) to the item's groups,
`is_available = TRUE`, `deleted_at IS NULL`.

## 4. Session gate (US-033 — with row lock)

At the TOP of the placement tx:
```sql
SELECT id, restaurant_id, table_id, status
FROM dining_sessions
WHERE id = $sessionID AND restaurant_id = $tenant AND deleted_at IS NULL
FOR UPDATE
```
- **PINNED — `FOR UPDATE` row lock.** US-033 is a stated invariant ("AWAITING_PAYMENT and
  CLOSED reject new orders"). C2/billing will bring concurrent writers
  (request-payment/close) that flip status between a plain read and the insert; the lock
  closes that race. Set the pattern now.
- `status != 'ACTIVE'` → reject with `apperr.CodeConflict` (409),
  message `"session is not accepting orders"`. (B1 middleware admits ACTIVE +
  AWAITING_PAYMENT; placement is stricter — ACTIVE only.)
- Session not found / tenant mismatch → 404 (should not happen post-middleware, but scope
  defensively).

## 5. Place-order — request & flow

Request body:
```json
{
  "note": "optional order-level note",
  "items": [
    {
      "menu_item_id": "<uuid>",
      "variant_id": "<uuid|null>",
      "quantity": 2,
      "note": "optional line note",
      "options": [ { "option_id": "<uuid>", "quantity": 1 } ]
    }
  ]
}
```
Empty `items` → 400 (`CodeInvalid`, "order must contain at least one item").

Flow inside the tx (after §4 session lock):
1. **Validate + snapshot each line** against §3 (per-line errors per §6). Pull the menu
   rows the line references (item, optional variant, the item's option groups + the
   referenced options) tenant-scoped.
2. **Option-group rules (Q15, US-018/022)** — for each option group attached to the item:
   - effective required = `COALESCE(menu_item_option_groups.is_required_override,
     option_groups.is_required)`.
   - count selected options in that group (sum of selected option lines' presence; a
     group's `SINGLE` type ⇒ at most 1 selected).
   - required group with 0 selected → error `missing_required_option`.
   - selected count `< min_selections` or (`max_selections` not null and `> max_selections`)
     → error `option_count_out_of_range`.
   - an option referencing a group NOT attached to the item, or not orderable → error
     `invalid_option`.
   - `quantity <= 0` on a line → `invalid_quantity`.
3. **Money math (PINNED — exact, with worked example):**
   ```
   unit_price_vnd      = variant.price_vnd (ABSOLUTE) if variant given, else menu_items.base_price_vnd
   options_total_vnd   = Σ ( option.price_delta_vnd × option_line.quantity )   // per single unit
   subtotal_vnd        = ( unit_price_vnd + options_total_vnd ) × line.quantity
   discount_amount_vnd = 0
   total_amount_vnd    = subtotal_vnd - discount_amount_vnd
   ```
   Worked example (codex AND reviewer check against this number):
   base `100000` + optionA delta `5000` ×qty `2` (=10000) + optionB delta `3000` ×qty `1`
   (=3000) ⇒ `options_total_vnd = 13000`; line qty `3` ⇒
   `subtotal_vnd = (100000 + 13000) × 3 = 339000`; `total_amount_vnd = 339000`.
   Note: variant `price_vnd` is ABSOLUTE (replaces base), option `price_delta_vnd` is a
   DELTA. Do not conflate.
4. **order_type (US-020 vs US-021):** `INITIAL` if no non-deleted `orders` row exists for
   this `dining_session_id` yet, else `ADDITIONAL`.
5. **Insert `orders`**: `status='SUBMITTED'`, `placed_by='GUEST'`, `placed_by_user_id=NULL`,
   `order_type` per §5.4, generated `order_number` (§7), `dining_session_id`, tenant,
   `note`.
6. **Insert `order_items`** (one per line): `status='PENDING'`, snapshots
   (`item_name_snapshot`, `item_code_snapshot`, `variant_name_snapshot` nullable),
   `unit_price_vnd`, `quantity`, `options_total_vnd`, `subtotal_vnd`,
   `discount_amount_vnd=0`, `total_amount_vnd`, `station` (§6/§8 fallback),
   `dining_session_id`, tenant, `note`.
7. **Insert `order_item_options`** per selected option: snapshots
   (`option_name_snapshot`, `option_group_name_snapshot`, `price_delta_snapshot_vnd`),
   `quantity`, `option_id`, `option_group_id`, tenant.
8. **Create kitchen tickets (§8).**
9. **Outbox**: write one `order.submitted` event row in-tx (payload: order_id,
   session_id, table_id, item summaries). **No realtime push in C1** — E consumes it later.
10. Build response (§9). Commit.

## 6. Per-line validation errors (US-022 "actionable")

US-022 demands actionable, per-line errors — NOT a flat 400. Validate ALL lines, collect
failures, and if any, return `apperr.CodeInvalid` (400) with a structured body:
```json
{
  "error": { "code": "INVALID", "message": "cart validation failed" },
  "line_errors": [
    { "index": 0, "menu_item_id": "<uuid>", "reason": "unavailable" },
    { "index": 1, "menu_item_id": "<uuid>", "reason": "missing_required_option", "option_group_id": "<uuid>" }
  ]
}
```
Reason codes: `unavailable`, `invalid_variant`, `invalid_option`,
`missing_required_option`, `option_count_out_of_range`, `invalid_quantity`,
`menu_item_not_found`. Pick the response-shaping that fits `httpx` (extend the error
payload or attach details) — but the per-line reasons MUST reach the client. No partial
orders: if ANY line fails, the whole order is rejected (nothing inserted).

## 7. Number generation (PINNED — no mid-tx retry)

`orders.order_number` and `kitchen_tickets.ticket_number` are `UNIQUE(restaurant_id, …)`.
- Generate **high-entropy random** values (prefix + crypto/rand base64url, reuse the same
  approach as B1's `session_code`) — e.g. `ORD-<rand>`, `TKT-<rand>`. Collision is
  astronomically improbable.
- Map any 23505 via `postgres.IsUniqueViolation` → `apperr.CodeConflict`.
- **Do NOT write a retry loop inside the tx** — a unique violation aborts the whole
  transaction; you cannot continue it. (If a human-readable sequential number is ever
  wanted for the kitchen, that's a sequence/counter design with its own contention —
  **deferred**, do not half-build it here.)

## 8. Kitchen tickets — per station (Q5/Q10)

Resolved decision Q5: kitchen is an **individual-item queue grouped by station**, not a
combined order card. For the placed order:
- Resolve each order_item's `station` = `menu_items.station` if non-null, else **`'GENERAL'`**
  (PINNED — `kitchen_tickets.station` is NOT NULL + CHECK; never insert null).
- Create **one `kitchen_tickets` row per distinct station** in this order
  (`status='PENDING'`, `priority='NORMAL'`, generated `ticket_number`, `order_id`,
  `dining_session_id`, `table_id` from the locked session, tenant).
- Create one `kitchen_ticket_items` row per order_item, linking it to its station's
  ticket (`status='PENDING'`).

## 9. Place-order response
```json
{
  "order_id": "<uuid>",
  "order_number": "ORD-...",
  "order_type": "INITIAL",
  "items": [ { "order_item_id","menu_item_id","name_snapshot","variant_name_snapshot",
               "quantity","unit_price_vnd","options_total_vnd","subtotal_vnd",
               "total_amount_vnd","status","station",
               "options":[{"name_snapshot","price_delta_snapshot_vnd","quantity"}] } ],
  "session_total_vnd": 339000
}
```
`session_total_vnd` = running total over all non-cancelled order_items in the session
(Q1 — running total is VISIBLE to guests). Compute post-insert.

## 10. View submitted items — `GET /guest/orders` (US-023)

Read-only (no tx). Session from context. Return all `orders` (+ their `order_items` +
`order_item_options`) for `dining_session_id`, excluding soft-deleted, ordered by
`submitted_at`. Include each item's current `status` (US-027 refresh loads latest state)
and the same `session_total_vnd` running total (Q1). Empty → `200` with empty arrays
(per B2 `200 []` convention), not 404.

## 11. Domain / repo work
- `ordering/domain/model.go`: ADD placement write models (order + line + option + ticket
  shapes) and view read models. Do NOT alter the existing thin `Order`/`OrderItem`,
  `allowedTransitions`, status consts, or `OrderRepository{Save,Get}` (those are D's /
  staff stubs' contract). Add a new repo interface for placement+view (e.g.
  `OrderPlacementRepository` / `OrderReadRepository`) rather than extending `OrderRepository`.
- Implement real SQL in `ordering/infrastructure/postgres/ordering_repository.go` (add the
  `q(ctx)` helper). Leave the stubbed `Save`/`Get` as-is.
- Handler: add `RegisterGuestRoutes(g *gin.RouterGroup)` (NO secret/JWT/RBAC — middleware
  already on `guestGroup`), wire `POST /orders` + `GET /orders`. `main.go`:
  `orderingHandler.RegisterGuestRoutes(guestGroup)` (the group B2 made live). Ordering must
  NOT import dining or catalog.

## 12. Tests (mirror A/B1/B2 — testify, faked repos, httptest)
- place-order: valid single-line success (asserts snapshots set, status PENDING,
  order_type INITIAL); second order same session → ADDITIONAL; money math matches the §5.3
  worked example exactly (assert `339000`); empty items → 400.
- validation: unavailable item → `unavailable` line error, nothing inserted; missing
  required option group → `missing_required_option`; option count > max → 
  `option_count_out_of_range`; bad quantity → `invalid_quantity`; multiple bad lines →
  multiple `line_errors`.
- session gate: AWAITING_PAYMENT / CLOSED session → 409, no insert.
- station/tickets: items across 2 stations → 2 kitchen_tickets, ticket_items per item;
  null `menu_items.station` → ticket station `GENERAL`.
- view: returns session orders+items+options with running total; empty session → 200 empty.
- guest routes require session token (middleware fires) — like B2.
- Suite green: `go build ./... && go vet ./... && go test ./...`.

## 13. Review rubric
- [ ] Guest endpoints under `guestGroup` (no JWT/RBAC re-applied); staff `/ordering`
      generic stubs + kitchen stubs untouched; ordering imports neither dining nor catalog.
- [ ] **Orderability predicate = `PUBLISHED AND is_available AND availability_status='AVAILABLE' AND not deleted`** (NOT B2's browse predicate); OUT_OF_STOCK/TEMP/HIDDEN/DRAFT all rejected.
- [ ] **Session gate with `FOR UPDATE`**; non-ACTIVE → 409, no insert (US-033 race closed).
- [ ] **Money math matches §5.3 formula + worked example (339000)**; variant price
      absolute, option delta per-unit × option.quantity, subtotal × line.quantity.
- [ ] Snapshots written (US-030): item name/code, variant name, unit price, option
      name/group/price-delta — order reads do not re-join live menu for historical fields.
- [ ] order_type INITIAL vs ADDITIONAL by prior-order existence in session.
- [ ] Per-line actionable errors (US-022) reach client; ANY failure ⇒ whole order rejected
      (atomic, nothing inserted).
- [ ] Numbers: high-entropy random, 23505→409, **NO mid-tx retry loop**.
- [ ] One kitchen_ticket per station per order; station fallback `GENERAL` (never null);
      kitchen_ticket_items per order_item.
- [ ] place-order in `tx.Run` (atomic); view outside tx; `QuerierFromContext`; tenant +
      session strictly from context, never request body.
- [ ] Running total VISIBLE in both responses (Q1). Empty view → 200 empty, not 404.
- [ ] `order.submitted` outbox row written in-tx; NO realtime push in C1. Tests per §12.
      build/vet/test green.

## 14. Deferred (stated, not silently dropped)
- **CHARGED_CANCEL** (Q2/Q3): not in `order_items.status` enum; billing-layer — deferred.
- **Realtime push** (US-027/028/034): outbox row only; broadcasting is E.
- **Human-readable sequential order/ticket numbers**: random for now; sequence design later.
- **Double-submit idempotency**: a guest double-tap creates two orders. **Accepted** for
  MVP (no idempotency key in C1) — revisit if it bites.
- **Staff-placed orders** (`placed_by='STAFF'`): C1 is guest-only; staff order entry later.
- **request-payment / AWAITING_PAYMENT transition** (US-029): C1 enforces the block only.

## 15. After C1 → C2 preview
Guest pending cancel/edit (US-024/025: only PENDING items, edits revalidate per §3/§5) +
cancel-request for ACKNOWLEDGED+ items (US-026, writes `cancel_requests`). Kitchen reviews
them in D. Per Q4, PENDING guest edits/cancels are NOT audit-logged; post-acceptance is.
