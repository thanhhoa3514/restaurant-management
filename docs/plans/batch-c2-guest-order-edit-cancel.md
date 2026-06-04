# Batch C2 — Guest order edit / cancel + cancel-request (codex implementation spec)

Status: **ready for codex**. Depends on **C1** (guest order placement: `orders`, `order_items`,
`order_item_options`, `kitchen_tickets`, `kitchen_ticket_items` populated; `OrderPlacementRepository` /
`OrderReadRepository`; money formula §C1.5; session gate `FOR UPDATE`). This file is the
implementation spec for codex and the review rubric for the reviewer.

## 0. Batch C split (recap)

- **C1** (done) — guest places & views orders. Every `order_item` inserted `status='PENDING'`.
- **C2 = guest edit / cancel pending lines + cancel-request (THIS FILE)** — US-024, US-025, US-026 (guest write side).
- **D** = kitchen (EPIC-06): status transitions (PENDING→ACKNOWLEDGED→PREPARING→READY→SERVED),
  `allowedTransitions`, **staff review of cancel-requests** (US-026 staff side), audit logging.
- **E** = realtime broadcasts + staff-call.

### 0.1 Load-bearing scoping fact (READ FIRST)

At C2 ship, **the only reachable `order_item.status` is `PENDING`.** Nothing in the codebase
moves an item to `ACKNOWLEDGED`/`PREPARING`/`READY`/`SERVED` yet — that is D (kitchen handler
is still `ErrNotImplemented`; staff `UpdateItemStatus` is a stub). Therefore:

- The **live, end-to-end-testable** C2 behavior is **PENDING edit / cancel** (US-024/025).
- The **product boundary** the user set is: *guest may adjust an order until it reaches
  `PREPARING`*. We honor that boundary in the API contract, but **the code editability
  predicate is `PENDING`** — the `ACKNOWLEDGED`-editable arm lands with D (it requires the
  re-acknowledge / status-revert semantics that live in `allowedTransitions`, which C1 §11
  fenced as D's). This is invisible at C2 ship because `ACKNOWLEDGED` cannot occur.
- The **cancel-request** endpoint (US-026 guest write) is built but **dormant pre-D**: its
  precondition is a `PREPARING` line, which cannot exist until D. Build it + unit-test it with
  **faked statuses**; its staff review (approve/reject) is **D**.

This is implementation sequencing, not a product change — see §11 Deferred. Reviewer: do not
flag the dormant paths as dead code; they are the consumer-before-producer pattern.

## 1. Scope (C2)

Three guest endpoints behind B1's session-token middleware, on the shared `guestGroup`
(same mount as B2 menu reads + C1 orders):

- `PUT    /api/v1/guest/orders/:orderId/items` — edit/cancel individual editable lines of an
  order (change quantity / line note / option selection; remove a line). **US-024/025.** **LIVE.**
- `DELETE /api/v1/guest/orders/:orderId` — cancel an entire order while **all** its lines are
  still editable. **US-024.** **LIVE.**
- `POST   /api/v1/guest/orders/:orderId/cancel-requests` — guest asks staff to cancel a line
  that is already **cooking** (`PREPARING`). **US-026 (guest write).** **DORMANT pre-D.**

**RESTful, no verb-in-URL, no merged endpoints** (this batch deliberately replaces the old
RPC stubs `/place-order`, `/cancel-or-edit-item`, … pattern — see §2.1). Each route does one
job; the HTTP method is the verb; `cancel_requests` is a real resource with an id + lifecycle.

### Out of scope (do NOT touch)
- The staff `/ordering` generic `Input`/`Output` + reflection `handle()` stubs — leave as-is.
- Kitchen routes (`ErrNotImplemented`) — D.
- `ordering/domain/model.go`'s existing thin `Order`/`OrderItem`, **`allowedTransitions`**,
  status consts, `OrderRepository{Save,Get}` — D's / staff stubs' contract. Add NEW models +
  a NEW repo interface (mirror C1's `OrderPlacementRepository` pattern).
- **Staff review of cancel-requests** (approve/reject `PATCH`) — D (it transitions an item to
  `CANCELLED` via `allowedTransitions` + audits it).
- C1's place/view code — reuse its money formula + validation helpers, do not rewrite them.

No migration — all tables exist in `00001` (`cancel_requests`, `order_items`, `order_item_options`,
`kitchen_tickets`, `kitchen_ticket_items`; `orders.version` + `order_items.version` already present).

## 2. Conventions (reuse A/B/C1 — do not reinvent)

- **Per-use-case DTOs** + direct handler binding; bind/parse errors → `apperr.CodeInvalid` (400).
- **Tenant + session strictly from context**: `tenant.MustRestaurantID(ctx)` +
  `guest.SessionFromContext(ctx)`. NEVER take restaurant_id/session_id/table_id from body or path
  for authorization. `:orderId` from the path is **always** re-scoped server-side
  (`WHERE id=$orderId AND restaurant_id=$tenant AND dining_session_id=$session`) — path presence
  ≠ trust (IDOR: cross-tenant/cross-session id → **404**).
- **Writes run INSIDE `tx.Run`** (multi-table: order_items + options + kitchen_ticket_items +
  kitchen_tickets + version bump + outbox must be atomic). Repo through `postgres.QuerierFromContext`
  via the C1 `q(ctx)` helper.
- **Modular-monolith data access (pinned, per C1 §2):** ordering repo queries catalog tables
  directly via SQL for re-validation + re-snapshot; do NOT import catalog or dining.
- Reuse C1's money formula (§C1.5) + per-line reason codes (§C1.6) verbatim for re-validation.

### 2.1 Why declarative `PUT`, not per-item RPC (design decision — pinned)

Discussed + chosen with the user. The edit surface is **declarative**: the client submits the
**desired state of an order's editable lines**, server diffs against current and reconciles.
Rationale: (a) not chatty — one call on confirm, not a server round-trip per add/remove;
(b) one mental model — "make the order look like this"; (c) idempotent (resend = same result);
(d) kills tester confusion from a merged `/update-or-cancel` verb endpoint that branched on a
body flag. The method is the verb: `PUT` = reconcile lines, `DELETE` = cancel whole order,
`POST …/cancel-requests` = ask staff.

**`PUT` edits/cancels EXISTING lines only — it does NOT add new lines.** Adding more food is a
**new ADDITIONAL order** via C1's `POST /orders` (reuses C1's ticket machinery). Stated
explicitly so it can be redirected on review if the user meant in-place append; new-order is the
cleaner default and the guest-visible outcome is identical.

## 3. Editability predicate (PINNED)

A line is **editable** by the guest iff:
```
order_item.restaurant_id = $tenant
  AND order_item.dining_session_id = $session
  AND order_item.order_id = $orderId
  AND order_item.deleted_at IS NULL
  AND order_item.status = 'PENDING'
```
- **Code predicate = `PENDING`** (per §0.1; `ACKNOWLEDGED`-editable is D).
- A payload line referencing a **non-editable** existing line:
  - `status IN ('PREPARING','READY','SERVED')` → per-line `line_locked` (409). (Product: cooking
    food is final; use cancel-request for `PREPARING`.)
  - `status='ACKNOWLEDGED'` → per-line `line_locked` (409) for now (cannot occur pre-D anyway).
  - `status='CANCELLED'` → per-line `line_already_cancelled` (409).
- A payload line referencing an id that is not an `order_item` of this order/session/tenant → **404**.

## 4. Session gate (US-033 — with row lock, reuse C1 §4)

At the TOP of every C2 write tx, lock the session row:
```sql
SELECT id, restaurant_id, table_id, status
FROM dining_sessions
WHERE id=$session AND restaurant_id=$tenant AND deleted_at IS NULL
FOR UPDATE
```
`status != 'ACTIVE'` → `apperr.CodeConflict` (409, `"session is not accepting changes"`).
Then lock the order row `… FROM orders WHERE id=$orderId AND restaurant_id=$tenant AND
dining_session_id=$session AND deleted_at IS NULL FOR UPDATE` — order not found / mismatch → 404;
`order.status='CANCELLED'` → 409 (`"order already cancelled"`).

## 5. `PUT /orders/:orderId/items` — edit / cancel lines (US-024/025)

### 5.1 Request
```json
{
  "version": 3,
  "items": [
    { "order_item_id": "<uuid>", "quantity": 2, "note": "less spicy",
      "options": [ { "option_id": "<uuid>", "quantity": 1 } ] }
  ]
}
```
- `version` (REQUIRED) — the `orders.version` the client last read. **Optimistic-lock guard**
  for the shared-session race (one `X-Session-Token` across multiple devices at a table → two
  concurrent `PUT`s → last-writer-wins clobber). If `version != orders.version` → **409**
  (`"order was modified, reload"`). Reuse the locked-row read from §4 to compare.
- `items` — desired state of the **editable** lines. Empty array → **400**
  (`"items required; to cancel the whole order use DELETE /orders/:orderId"`) — guards against an
  accidental empty payload wiping the order.
- Each entry references an EXISTING `order_item_id` (no add — §2.1). `quantity` / `note` /
  `options` are the desired post-edit values for that line.

### 5.2 Reconciliation (inside the tx, after §4 locks)
1. Load all editable (`PENDING`) lines of the order (+ their `order_item_options`).
2. **Diff:**
   - `order_item_id` present in payload **and** currently editable → **update** that line.
   - editable line **absent** from payload → **cancel** that line (§5.4).
   - payload `order_item_id` not editable / not found → per-line error (§3), and (per C1) **any
     line error rejects the whole `PUT` — nothing is mutated.**
3. **Update a line (§5.3):** re-validate the *resulting* line via C1's rules (orderability §C1.3,
   option-group rules §C1.5, `quantity>0`); recompute `unit_price_vnd` / `options_total_vnd` /
   `subtotal_vnd` / `total_amount_vnd` with C1's exact money formula; re-snapshot option rows
   (delete + reinsert `order_item_options` for that line, or diff — either is fine since the line
   is PENDING and un-acknowledged). Re-snapshot price/name only on change is acceptable; simplest
   is recompute-from-current-menu since the item is not yet acknowledged.
4. **Cancel a line (§5.4):** set `order_item.status='CANCELLED'`, `cancelled_at=NOW()`,
   `cancelled_reason='guest_edit'`, bump `order_item.version`. **Cascade (PINNED, §6).**
5. Bump `orders.version = version + 1`, `orders.updated_at=NOW()`.
6. If **all** of the order's lines are now `CANCELLED`, set `orders.status='CANCELLED'`,
   `cancelled_at=NOW()`, `cancelled_reason='guest_edit'` (same end-state as §7 DELETE).
7. **Outbox**: one `order.updated` event in-tx (payload: order_id, session_id, changed line ids,
   new totals). No realtime push (E).
8. Recompute + return response (§8). Commit.

### 5.3 Re-validation nuance (PINNED)
- **Reducing** commitment (lower quantity, remove an option, or removing the whole line via
  absence) is **always allowed**, even if the menu item has since gone `OUT_OF_STOCK`/unavailable
  — the guest is walking back, never block that.
- **Increasing** commitment (raise quantity, add an option) **re-validates** orderability §C1.3:
  a now-unavailable item / option → per-line error (`unavailable` / `invalid_option`).
- Implement as: if the new line's `quantity` > current OR a new `option_id` appears that wasn't
  selected before → run full §C1.3 orderability; otherwise skip the availability check (still run
  option-group min/max/required + `quantity>0`).

## 6. Kitchen-ticket cascade on cancel (PINNED — in scope for C2)

C1 created a `kitchen_ticket_items` row for **every** line (all PENDING). So cancelling a line
(via §5.4 or §7) MUST cascade:
- Set the line's `kitchen_ticket_items.status='CANCELLED'`.
- If **all** `kitchen_ticket_items` of a `kitchen_tickets` row are now `CANCELLED`, set that
  `kitchen_tickets.status='CANCELLED'` (do not orphan an all-cancelled ticket as PENDING).
- All scoped `restaurant_id=$tenant`. No status-machine call — these are direct PENDING→CANCELLED
  writes on rows this guest's order owns; `allowedTransitions` (D) is NOT touched.

## 7. `DELETE /orders/:orderId` — cancel whole order (US-024)

Cancel an entire order while **every** line is still editable (`PENDING`):
- §4 locks. If any line is non-`PENDING` → **409** (`"order has items already in the kitchen"`)
  — guest must edit/keep the rest or use cancel-request per line. (Cannot occur pre-D.)
- Set every line `CANCELLED` (§5.4 fields) + cascade tickets (§6) + `orders.status='CANCELLED'`,
  `cancelled_at`, `cancelled_reason='guest_cancel'`, bump `orders.version`.
- Outbox `order.cancelled` in-tx. Returns the cancelled order view (§8) or `204`. Pick `200` +
  body for consistency with the other guest reads.

## 8. Response (PUT + DELETE)
Return the **same order shape C1 returns** (so the client refreshes one order), plus the running
session total:
```json
{
  "order_id": "<uuid>", "order_number": "ORD-...", "order_type": "INITIAL",
  "version": 4, "status": "SUBMITTED",
  "items": [ { "order_item_id","menu_item_id","name_snapshot","variant_name_snapshot",
               "quantity","unit_price_vnd","options_total_vnd","subtotal_vnd","total_amount_vnd",
               "status","station","options":[{"name_snapshot","price_delta_snapshot_vnd","quantity"}] } ],
  "session_total_vnd": 226000
}
```
`session_total_vnd` = C1's running total over **non-cancelled** order_items in the session
(cancelled lines now excluded → total drops, which is the visible effect of an edit). Include the
new `orders.version` so the client can send it on its next `PUT`.

## 9. `POST /orders/:orderId/cancel-requests` — guest asks staff to cancel a cooking line (US-026, DORMANT)

### 9.1 Request
```json
{ "order_item_id": "<uuid>", "reason": "ordered by mistake" }
```
### 9.2 Flow (inside tx, after §4 session+order lock)
- Resolve the line (scoped tenant+session+order). Not found → 404.
- **Eligibility:** `status='PREPARING'` only (cooking, not yet delivered).
  - `PENDING` → 409 (`"use PUT to edit pending items"`).
  - `ACKNOWLEDGED` → 409 (not eligible; revisit in D).
  - `READY`/`SERVED` → 409 (`"item already prepared"` — billing handles).
  - `CANCELLED` → 409.
- **Idempotency:** at most one **open** (`status='PENDING'`) `cancel_requests` row per
  `order_item_id`. If one exists → 409 (`"cancel request already pending"`). (Enforce by a guarded
  `SELECT … FOR UPDATE` existence check inside the tx; a partial unique index is a nice-to-have,
  not required for C2.)
- Insert `cancel_requests`: `order_item_id`, `restaurant_id=$tenant`, `requested_by='GUEST'`,
  `reason`, `status='PENDING'`. **Do NOT change `order_item.status`** — the item keeps cooking
  until staff approves (D). 
- Outbox `cancel_request.created` in-tx (payload: cancel_request_id, order_item_id, session_id).
- Response: `{ "cancel_request_id","order_item_id","status":"PENDING" }` (201).

> Pre-D this endpoint cannot be reached with a real `PREPARING` line; unit-test it with a faked
> `PREPARING` status (see §12). Staff approve/reject (`PATCH`) is **D**.

## 10. Domain / repo / wiring
- `ordering/domain/model.go`: ADD edit/cancel write models + a `CancelRequest` model + a NEW repo
  interface (e.g. `OrderEditRepository` with `LockSessionAndOrder`, `LoadEditableLines`,
  `UpdateLine`, `CancelLine`, `CascadeTicketsForCancelledLines`, `BumpOrderVersion`,
  `CancelOrder`, `CreateCancelRequest`, `OpenCancelRequestExists`, `SessionTotal`). Do NOT alter
  `Order`/`OrderItem`/`allowedTransitions`/status consts/`OrderRepository{Save,Get}`.
- `ordering/infrastructure/postgres/ordering_repository.go`: implement the SQL (reuse `q(ctx)`,
  the catalog re-validation queries `FindMenuItemForOrder`/`FindVariantForOrder`/
  `ListOptionGroupRules`/`ListOptionsForOrder` from C1, and `SessionTotal`). Leave `Save`/`Get` stubs.
- `application/`: `guest_edit_order.go` (PUT), `guest_cancel_order.go` (DELETE),
  `guest_request_cancel.go` (POST cancel-requests). Reuse C1's `CartValidationError` +
  money/option helpers; refactor them to shared funcs if needed (don't duplicate the formula).
- `interfaces/http/handler.go`: extend `RegisterGuestRoutes(g)`:
  ```go
  g.PUT("/orders/:orderId/items", h.guestEditOrder)
  g.DELETE("/orders/:orderId", h.guestCancelOrder)
  g.POST("/orders/:orderId/cancel-requests", h.guestRequestCancel)
  ```
  No JWT/RBAC (middleware already on `guestGroup`). Staff review route NOT added (D). Ordering must
  not import dining or catalog.

## 11. Deferred (stated, not silently dropped)
- **ACKNOWLEDGED-edit semantics** (re-acknowledge / status-revert when editing an acknowledged
  item) → **D** (needs `allowedTransitions`). Code editability = `PENDING` until then; product
  boundary `PREPARING` is documented but invisible pre-D (§0.1).
- **Staff review of cancel-requests** (approve/reject `PATCH`, transitions item → `CANCELLED`,
  audited) → **D** (US-026 staff side).
- **Realtime push** of `order.updated`/`order.cancelled`/`cancel_request.created` → **E** (outbox
  row only in C2).
- **Audit logging** of guest edits/cancels → none in C2 (per Q4, pre-acceptance guest edits are
  NOT audit-logged; post-acceptance is, and that's D).
- **In-place append** (adding a line to an existing order via `PUT`) → not built; add = new
  ADDITIONAL order via C1 `POST /orders` (§2.1). Revisit only if the user wants append.
- **CHARGED_CANCEL** (billing-layer enum, not in `order_items.status`) → billing/F.

## 12. Tests (mirror A/B/C1 — testify, faked repos, httptest)
- **PUT edit (live):** lower a line's quantity → `subtotal`/`total`/`session_total_vnd` recomputed
  (assert exact numbers via C1 formula); change options → money + snapshots recomputed; line note
  edit persists.
- **PUT cancel-by-absence:** omit an editable line → it becomes `CANCELLED`, its
  `kitchen_ticket_items` → `CANCELLED`, and the `kitchen_tickets` row → `CANCELLED` when it was the
  last live item (assert §6 cascade); `session_total_vnd` drops accordingly.
- **PUT all lines removed** → order auto-`CANCELLED` (§5.2.6).
- **PUT optimistic lock:** stale `version` → 409, nothing mutated.
- **PUT empty items** → 400. **PUT line not in order/session** → 404.
- **PUT increase quantity on now-unavailable item** → `unavailable` line error, nothing mutated;
  **PUT decrease quantity on now-unavailable item** → allowed (§5.3).
- **PUT locked line** (faked `PREPARING` in repo) → `line_locked` 409.
- **DELETE whole order:** all PENDING → order + items + tickets `CANCELLED`; any non-PENDING
  (faked) → 409.
- **cancel-request (faked `PREPARING`):** create → `cancel_requests` row PENDING, item status
  unchanged; duplicate open request → 409; PENDING line → 409; READY/SERVED (faked) → 409.
- **session gate:** non-ACTIVE session → 409 on all three endpoints, no write.
- **IDOR:** order_id from another session/tenant → 404 on all three.
- Suite green: `go build ./... && go vet ./... && go test ./...`.

## 13. Review rubric
- [ ] Three guest routes under `guestGroup` (no JWT/RBAC re-applied); staff `/ordering` generic
      stubs + kitchen stubs + `allowedTransitions`/`Order`/`OrderItem`/`OrderRepository{Save,Get}`
      all untouched; ordering imports neither dining nor catalog.
- [ ] **Declarative `PUT`**: edits/cancels existing PENDING lines by diffing desired-state payload;
      does NOT add new lines; empty `items` → 400.
- [ ] **Editability predicate = `PENDING`** (code); non-PENDING line in payload → `line_locked`
      409; cross-session/tenant order id → 404 (IDOR).
- [ ] **Optimistic lock**: `version` mismatch → 409, no mutation (shared-session race closed).
- [ ] **Re-validation asymmetry**: reducing commitment always allowed even if now unavailable;
      increasing commitment re-checks orderability §C1.3.
- [ ] **Money recomputed** via C1's exact formula on edit; option snapshots rewritten; tests assert
      exact numbers.
- [ ] **Kitchen-ticket cascade** on every cancel (§6): `kitchen_ticket_items`→CANCELLED, and the
      `kitchen_tickets`→CANCELLED when its last live item is cancelled. Never orphaned.
- [ ] **DELETE** cancels a whole all-PENDING order (+ cascade); any non-PENDING line → 409.
- [ ] Any line error ⇒ whole `PUT` rejected (atomic, nothing mutated) — reuse C1's all-or-nothing.
- [ ] All writes in `tx.Run` with session+order `FOR UPDATE`; tenant+session from context, never
      body/path-for-auth; `:orderId` re-scoped server-side.
- [ ] `cancel_requests` (POST): `PREPARING`-only eligibility, one open request per item (idempotent
      409), item status unchanged, `requested_by='GUEST'`; staff review absent (D). Dormant-path
      tests use faked statuses.
- [ ] Running `session_total_vnd` (excludes CANCELLED) + new `orders.version` in PUT/DELETE
      responses. Outbox `order.updated`/`order.cancelled`/`cancel_request.created` written in-tx;
      no realtime push. build/vet/test green.

## 14. After C2 → D preview
Kitchen (EPIC-06): real status transitions via `allowedTransitions` (PENDING→ACKNOWLEDGED→
PREPARING→READY→SERVED), `order_item_status_history`, staff **review** of the cancel_requests C2
wrote (approve → item CANCELLED + ticket cascade + audit; reject → request REJECTED), and the
`ACKNOWLEDGED`-edit arm deferred from §0.1. Then E adds realtime push for all C2/D outbox events.
