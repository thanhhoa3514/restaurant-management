# Batch F — Billing & cashier payment (codex implementation spec)

Status: **ready for codex**. Depends on **C1** (orders/order_items/order_item_options +
`tx.Run`, `QuerierFromContext`, outbox patterns) and **B1** (dining_sessions,
`tenant.MustRestaurantID`). This file is the implementation spec for codex and the review
rubric for the reviewer.

This batch makes the **cashier** screen real. Today the cashier reads live sessions
(`GET /api/v1/staff/tables`) but computes the invoice client-side and keeps every
write — discount, payment, close — in a local reducer. Billing endpoints exist as
`ErrNotImplemented` stubs; dining `close-session` is also still a stub. F implements them.

## 0. The spine — frontend action to endpoint map (READ THIS FIRST)

The cashier reducer (`frontend/src/features/cashier/hooks/use-cashier.tsx`) has ~8 actions.
They do NOT map 1:1 to the 3 existing billing stubs. Pinned mapping:

| Cashier action | Backend | Notes |
|---|---|---|
| select session, show invoice | `POST /billing/build-invoice` | **idempotent get-or-create**, returns full invoice DTO (section 5). This is the READ path — there is no separate GET. |
| `applyDiscount` / `removeDiscount` | `POST /billing/adjust-invoice` | inline invoice discount (section 6). NOT the `discounts` coupon table. |
| `completePayment` | `POST /billing/process-payment` | records payment, marks invoice PAID, closes session + frees table (section 7). |
| `closeSession` | `POST /dining/close-session` | implement the dining stub (section 8). |
| `startPayment` | — | local UI step only (cashier picks method before confirming). No backend call. |
| `failPayment` | — | **deferred** (section 11). Stays local for now; `process-payment` only records success. |
| `injectBill`, `resetAll`, `tick`, `setPaused`, `setTimeMultiplier` | — | demo simulation; removed/kept-local in the frontend-wiring step, not codex's concern. |

Items 1–4 are the whole job. Get the build-invoice get-or-create + the inline-discount
decision right and the rest is C1-style detail.

## 1. Scope (F)

Billing routes already mounted (`/billing`, `auth.JWT` + `auth.RBAC("CASHIER","MANAGER")`,
`cmd/api/main.go:144`). Implement:
- `POST /api/v1/billing/build-invoice` — get-or-create the session's invoice, return full DTO.
- `POST /api/v1/billing/adjust-invoice` — set/clear the inline invoice discount, recompute.
- `POST /api/v1/billing/process-payment` — record a payment, mark PAID, close session.

Plus the dining dependency the cashier close button needs:
- `POST /api/v1/dining/close-session` — implement the existing stub (section 8).

Plus seed data the flow can't run without:
- Seed `payment_methods` rows for the demo restaurant (section 9).

Out of scope (do NOT touch): the `/billing/payments/webhook` route (stays
`ErrNotImplemented`); the `discounts` coupon-catalog table; partial/split payments;
refunds; voids; `failPayment`. All listed in section 11 deferred — state them, don't drop.

No migration — all tables exist in `00001` (`invoices`, `invoice_items`, `payments`,
`payment_methods`). The `00001` schema is authoritative; do not alter it.

## 2. Conventions (reuse A/B1/C1 — do not reinvent)

- **Replace the reflection `handle()` glue.** The current billing handler binds a generic
  `Input{RestaurantID}` / `Output{ID,Status}` via reflection. Replace it with **per-use-case
  DTOs + direct handler binding**, exactly as C1 did for guest routes. Bind/parse errors →
  `apperr.Wrap(apperr.CodeInvalid, "invalid request body", err)` (→400). Delete the generic
  `Input`/`Output` in `application/dto.go`; add per-use-case request/response types.
- **Tenant + actor strictly from context, never request body.** `tenant.MustRestaurantID(ctx)`
  for `restaurant_id`. Actor (cashier user) from JWT: mirror `staffUpdateItemStatus`
  (`ordering/.../handler.go:225`) —
  ```go
  var actorID *uuid.UUID
  if id, err := uuid.Parse(c.GetString(auth.CtxUserID)); err == nil && id != uuid.Nil {
      actorID = &id
  }
  // role: c.GetString(auth.CtxRole)
  ```
  `issued_by`, `processed_by`, `voided_by`, `closed_by` all come from this actor, never body.
- **All three billing use-cases are multi-table writes → run INSIDE `tx.Run`.** Repo through
  `postgres.QuerierFromContext`; add a `q(ctx)` helper to the billing repo (mirror ordering).
- **Modular-monolith direct SQL (pinned).** Billing reads `dining_sessions`, `orders`,
  `order_items`, `order_item_options` directly via SQL to build the invoice, and writes
  `dining_sessions`/`tables` directly to close the session. Do NOT import the ordering or
  dining modules. This duplicates table knowledge across modules — **accepted** for the MVP
  (matches C1's ordering repo reading catalog tables directly).
- **Outbox in-tx**, same shape as ordering:
  `s.outbox.Write(ctx, outbox.WriteEvent{RestaurantID, AggregateType, AggregateID, EventType, Payload})`.
  No realtime push here — the dispatcher (E) consumes the row.
- **Numbers** (`invoice_number`, `payment_number`) are `UNIQUE(restaurant_id, …)`: generate
  high-entropy random (`INV-<rand>`, `PAY-<rand>`, reuse C1's `order_number` approach).
  23505 → `apperr.CodeConflict` via `postgres.IsUniqueViolation`. **No mid-tx retry loop.**

## 3. Repo + domain rework

`billing/domain/model.go` today has thin `Invoice/InvoiceItem/Discount/Payment` structs and
an `InvoiceRepository{Save,Get}` that doesn't fit this flow. Rework:
- Keep `PaymentStatus` consts but align to the schema CHECK
  (`PENDING/PROCESSING/COMPLETED/FAILED/REFUNDED`). Invoice status enum is
  `DRAFT/PENDING/PAID/PARTIALLY_PAID/VOID/REFUNDED`. Use `COMPLETED` (not `CONFIRMED`) for a
  paid payment — schema has no CONFIRMED.
- Add read/write models for the full invoice aggregate (invoice + items + the session's
  order lines it snapshots from) and a repo interface built around the use-cases (get invoice
  by session, insert invoice + items, update invoice discount/totals, insert payment + mark
  invoice PAID + close session) — not the generic `Save/Get`.
- Implement real SQL in `billing/infrastructure/postgres/billing_repository.go` (replace both
  `ErrNotImplemented` stubs). Add `q(ctx)` helper.

## 4. Money math (PINNED — authoritative, server-side)

The frontend currently computes VAT inconsistently (helper 10%, mapper 8%) and never applies
service charge. **Backend is authoritative; the frontend will stop computing and display
these numbers verbatim.** This changes displayed totals — it is an intended correction, not a
regression; the frontend-wiring step expects it.

Read rates from the `restaurants` row (seed = `vat_rate_basis_points=800` (8%),
`service_charge_basis_points=500` (5%)) and **snapshot them into the invoice** so a later
rate change doesn't mutate historical invoices:

```
subtotal_vnd                = Σ order_items.total_amount_vnd        // non-cancelled lines only
discount_amount_vnd         = inline discount (section 6), 0 if none, clamped 0..subtotal
service_charge_basis_points = restaurants.service_charge_basis_points   // snapshot
service_charge_amount_vnd   = round( (subtotal - discount) × service_charge_bps / 10000 )
vat_basis_points            = restaurants.vat_rate_basis_points          // snapshot
vat_amount_vnd              = round( (subtotal - discount + service_charge) × vat_bps / 10000 )
rounding_amount_vnd         = 0    // deferred, keep 0
total_amount_vnd            = subtotal - discount + service_charge + vat + rounding
```
Pin: discount applies BEFORE service charge and VAT; service charge is in the VAT base.
Integer math throughout (`math.Round` on the division, all int64). Worked example (codex AND
reviewer check): subtotal `500000`, discount `50000`, svc 5%, vat 8% ⇒
svc = round(450000×0.05)=`22500`; vat = round(472500×0.08)=`37800`; total =
`500000-50000+22500+37800 = 510300`.

`invoice_items`: one row per non-cancelled `order_item`, `item_type='MENU_ITEM'`,
`order_item_id` set, snapshots (`name_snapshot`, `unit_price_vnd`, `quantity`,
`subtotal_vnd`=order_item.subtotal_vnd, `discount_amount_vnd`=0,
`total_amount_vnd`=order_item.total_amount_vnd), `display_order` by order submit time.

## 5. build-invoice (PINNED — idempotent get-or-create; this is the READ path)

Request: `{ "dining_session_id": "<uuid>" }`. (tenant from ctx.)

Flow inside `tx.Run`:
1. Lock the session: `SELECT … FROM dining_sessions WHERE id=$1 AND restaurant_id=$tenant
   AND deleted_at IS NULL FOR UPDATE`. Not found → 404. Status must be `AWAITING_PAYMENT`
   or `ACTIVE` — if `CLOSED` → 409 `"session is closed"`. (Bill is normally requested first
   via the existing `staff/sessions/:id/request-bill` which flips ACTIVE→AWAITING_PAYMENT;
   build-invoice tolerates either so the cashier can open an invoice without a prior request.)
2. **Idempotency (no DB unique constraint on session — enforce in code):** if a non-VOID
   invoice already exists for this `dining_session_id`, load it (+ items) and return it
   unchanged. Do NOT create a second invoice. (A `VOID` invoice is ignored — a fresh one may
   be built; voids are deferred section 11 so in practice none exist yet.)
3. Else snapshot the session's non-cancelled order lines into a new `invoices` row
   (`status='PENDING'`, generated `invoice_number`, `invoice_type='STANDARD'`,
   `dining_session_id`, tenant, rates snapshotted section 4, `issued_at`=NULL until paid) +
   one `invoice_items` row per line (section 4). Compute and persist all money fields
   (section 4) with `discount_amount_vnd=0`.
4. Outbox `billing.invoice_built` (payload: invoice_id, session_id, total). Return DTO (section 10).

Empty session (no non-cancelled items) → still create a zero-total invoice (cashier may need
to close an empty session), `total_amount_vnd=0`.

## 6. adjust-invoice (PINNED — inline discount, NOT the coupon table)

The cashier discount is ad-hoc: an `amount` + a reason from `promo|regular|complaint`. That
maps to `invoices.discount_amount_vnd` + `invoices.discount_reason` — **inline fields, not
the `discounts` coupon-catalog table** (codes/percent/usage-limits — a different, deferred
feature section 11).

Request: `{ "invoice_id": "<uuid>", "discount_amount_vnd": 50000, "reason": "promo" }`.
`discount_amount_vnd=0` (or reason empty) clears the discount.

Flow inside `tx.Run`:
1. Load + lock the invoice (tenant-scoped) `FOR UPDATE`. Not found → 404. If `status`
   is `PAID`/`VOID`/`REFUNDED` → 409 `"invoice not adjustable"` (only `DRAFT`/`PENDING`).
2. Clamp `discount_amount_vnd` to `0 .. subtotal_vnd`; reject negative → 400. Validate
   `reason` ∈ allowed set (or empty) → else 400.
3. Recompute service charge / vat / total per section 4 with the new discount. Persist
   `discount_amount_vnd`, `discount_reason`, recomputed totals; bump `version`.
4. Outbox `billing.invoice_adjusted`. Return the full invoice DTO (section 10).

## 7. process-payment (PINNED — single full payment, closes session)

Request:
```json
{
  "invoice_id": "<uuid>",
  "payment_method_code": "cash",
  "received_amount_vnd": 600000,
  "reference_code": "optional gateway ref / bank txn"
}
```
Flow inside `tx.Run`:
1. Load + lock the invoice `FOR UPDATE` (tenant-scoped). Not found → 404. If already `PAID`
   → 409 `"invoice already paid"`; if `VOID`/`REFUNDED` → 409.
2. Resolve `payment_method_id` from `payment_methods WHERE restaurant_id=$tenant AND
   code=$code AND is_active AND deleted_at IS NULL`. Not found → 400 `"unknown payment method"`.
3. **Full payment only (deferred: partial/split section 11).** `received_amount_vnd` must be
   `>= invoice.total_amount_vnd` → else 400 `"insufficient amount"`. `change_amount_vnd =
   received_amount_vnd - total_amount_vnd`. Pin: cash allows change; for non-cash methods you
   MAY require `received == total` — or allow change for all and let the frontend hide it for
   cards (simpler, acceptable).
4. Insert `payments`: `status='COMPLETED'`, generated `payment_number`, `invoice_id`,
   `dining_session_id`, `payment_method_id`, `amount_vnd=invoice.total_amount_vnd`,
   `received_amount_vnd`, `change_amount_vnd`, `reference_code`, `processed_at=NOW()`,
   `processed_by=actorID`, tenant.
5. Update `invoices`: `status='PAID'`, `paid_amount_vnd=total_amount_vnd`,
   `change_amount_vnd`, `paid_at=NOW()`, `issued_at=COALESCE(issued_at,NOW())`,
   `issued_by=actorID`; bump `version`.
6. **Close the session + free the table** (direct SQL, no dining import): set
   `dining_sessions.status='CLOSED'`, `closed_at=NOW()`, `closed_by=actorID`, bump version;
   set the table's `status` back to its idle value (read how `tables.status` is set by
   dining open-session and reverse it — likely `'AVAILABLE'`; confirm against the dining
   open-session repo, do not guess the literal).
7. Outbox `billing.payment_completed` (payload: payment_id, invoice_id, session_id, amount)
   AND `dining.session_closed` (payload: session_id) so the realtime layer frees the table
   in the waiter/cashier views. Return DTO (section 10).

## 8. dining close-session (implement the stub)

`internal/modules/dining/application/close_session.go` is `ErrNotImplemented`. The cashier
"close" button (and a manual staff close) needs it. Implement in the **dining** module
(billing closing-on-payment in section 7 is the happy path; this is the explicit/standalone close):
- Request carries `session_id` (already wired). Lock the session `FOR UPDATE` tenant-scoped.
- Allow close from `ACTIVE` or `AWAITING_PAYMENT`; already `CLOSED` → idempotent no-op
  (return current state). Set `status='CLOSED'`, `closed_at`, `closed_by`=actor, free the
  table (same literal as section 7.6), bump version.
- Outbox `dining.session_closed`. Return the closed session state.
- **Guard (pin):** if the session has a non-VOID invoice that is NOT `PAID`, reject with 409
  `"settle invoice before closing"` — don't strand an unpaid invoice. (Dining queries
  `invoices` by session via SQL, no billing import.)

## 9. Seed payment_methods (flow can't run without it)

`payment_methods` has no seed rows; `process-payment` section 7.2 will 400 on every call. Add
to `cmd/seed/main.go` for the demo restaurant (idempotent `ON CONFLICT (restaurant_id, code)`):

| code | name | type |
|---|---|---|
| `cash` | Tiền mặt | `CASH` |
| `card` | Thẻ | `CARD` |
| `momo` | MoMo | `E_WALLET` |
| `zalopay` | ZaloPay | `E_WALLET` |
| `vnpay` | VNPay | `E_WALLET` |

Frontend `SubMethod` (`cash|card|momo|zalopay|vnpay`) maps directly to these `code`s; the
`PaymentMethod` family (`cash|card|ewallet`) is the `type`.

## 10. Response DTO (all three endpoints return the full invoice)

So the cashier can re-render after every action without a second fetch:
```json
{
  "invoice": {
    "id": "<uuid>",
    "invoice_number": "INV-...",
    "dining_session_id": "<uuid>",
    "status": "PENDING|PAID",
    "subtotal_vnd": 500000,
    "discount_amount_vnd": 50000,
    "discount_reason": "promo",
    "service_charge_basis_points": 500,
    "service_charge_amount_vnd": 22500,
    "vat_basis_points": 800,
    "vat_amount_vnd": 37800,
    "total_amount_vnd": 510300,
    "paid_amount_vnd": 0,
    "change_amount_vnd": 0,
    "issued_at": null,
    "paid_at": null,
    "version": 1,
    "items": [
      { "id": "", "order_item_id": "", "name_snapshot": "", "unit_price_vnd": 0,
        "quantity": 0, "subtotal_vnd": 0, "discount_amount_vnd": 0, "total_amount_vnd": 0 }
    ],
    "payment": null
  }
}
```
`payment` is non-null after process-payment: `{ id, payment_number, method_code, method_type,
amount_vnd, received_amount_vnd, change_amount_vnd, status, reference_code, processed_at }`.
snake_case JSON throughout, VND `int64`, timestamps RFC3339.

## 11. Deferred (stated, not silently dropped)

- **Coupon catalog** (`discounts` table: codes, percent_bps, usage limits, validity) —
  separate feature; F does inline invoice discount only.
- **Partial / split payments** (`PARTIALLY_PAID`, multiple payments per invoice) — F is
  single full payment. Schema supports it; logic deferred.
- **Refunds / voids** (`REFUNDED`, `VOID`, invoice `voided_*`, payment refund fields) — the
  frontend has a `void-dialog` and `failPayment`; those stay **local-only** after F. Say so
  in the wiring step so the reviewer doesn't flag them as missing.
- **Payment webhook** (`/billing/payments/webhook`) — stays `ErrNotImplemented` (online
  gateway integration later).
- **`failPayment`** — process-payment only records success; failure path is local UI for now.
- **Rounding** (`rounding_amount_vnd`) — kept 0; cash-rounding rules deferred.

## 12. Tests (mirror C1 — testify, faked repos, httptest)

- build-invoice: AWAITING_PAYMENT session with 2 orders → invoice with items, money math
  matches section 4; **second call returns the SAME invoice id** (idempotency); CLOSED
  session → 409; empty session → zero-total invoice.
- adjust-invoice: set discount → totals recomputed per section 4 (assert `510300` for the
  worked example); clear (0) → totals back; discount > subtotal clamped; PAID invoice → 409;
  bad reason → 400.
- process-payment: full cash with change → payment COMPLETED, invoice PAID, session CLOSED,
  table freed, change correct; insufficient amount → 400; unknown method code → 400; already
  PAID → 409.
- close-session: ACTIVE/AWAITING_PAYMENT → CLOSED + table freed; unpaid non-VOID invoice →
  409; already CLOSED → idempotent.
- handler: tenant + actor from context, never body; bind error → 400.
- Suite green: `go build ./... && go vet ./... && go test ./...`.

## 13. Review rubric

- [ ] Reflection `handle()` + generic `Input/Output` replaced with per-use-case DTOs +
      direct binding (like C1 guest routes). Webhook route still `ErrNotImplemented`.
- [ ] **build-invoice is idempotent get-or-create** — second call returns same invoice, no
      duplicate (enforced in code; no DB unique on session). It IS the read path; no GET added.
- [ ] **Discount is inline invoice fields** (`discount_amount_vnd`/`discount_reason`), NOT the
      `discounts` coupon table. Clamped 0..subtotal; reason validated.
- [ ] **Money math matches section 4 formula + worked example (`510300`)**; discount before
      svc+vat; svc in VAT base; rates **snapshotted** from `restaurants` bps into the invoice.
- [ ] process-payment: full-only, COMPLETED payment, invoice PAID, change computed, session
      CLOSED + table freed (correct idle literal, confirmed against dining open-session).
- [ ] dining close-session implemented; rejects unpaid non-VOID invoice; idempotent on CLOSED.
- [ ] All writes in `tx.Run`; `QuerierFromContext`; tenant + actor strictly from context.
      Billing imports neither ordering nor dining (direct SQL); dining doesn't import billing.
- [ ] Numbers high-entropy random; 23505→409; **no mid-tx retry loop**.
- [ ] Outbox rows in-tx (`billing.invoice_built/adjusted`, `billing.payment_completed`,
      `dining.session_closed`); NO realtime push in F.
- [ ] payment_methods seeded (5 rows, idempotent); process-payment resolves method by code.
- [ ] All endpoints return full invoice DTO (section 10), snake_case, int64 VND. Tests per
      section 12; build/vet/test green.
- [ ] Deferred items (section 11) not half-built: no coupon logic, no partial/refund/void/webhook.

## 14. After F → frontend wiring (Claude, post-review)

Once F lands and review passes: add `frontend/src/features/billing/api.ts`
(`buildInvoice`, `adjustInvoice`, `processPayment`) + `closeSession` in dining api, replace
the cashier reducer's local discount/payment/close branches with mutations that call these
and re-render from the returned invoice DTO. Drop the demo-sim actions (`injectBill`,
`resetAll`, tick/speed). Note the totals will change (real 8% VAT + 5% service charge vs the
old client-side 8%/10%) — expected, not a regression. `failPayment` + void-dialog stay local
until refunds/voids batch.
