# Combo Meals (Set Menus) — Cross-Station Fan-Out

**Status:** Spec (no code yet)
**Author:** Claude (spec), codex (backend impl), thanhhoa3514 (vision + review)
**Date:** 2026-08-07
**Branch target:** `feat/add-sepay` (or a fresh `feat/combo-meals` cut from it)

## Goal

Let a guest order a **combo / set menu** — one priced bundle ("Combo Lẩu 2
người", "Set Nướng nhóm 4") that expands into its component dishes. The combo
carries a single **fixed price** (cheaper than the sum of its parts), but each
component dish is still cooked independently and routed to its own kitchen
station. Admins build combos from existing menu items.

This is a headline thesis feature: it exercises the whole stack — snapshot
pricing, cross-station kitchen fan-out, per-item status, billing rollup — in
one coherent flow, and demonstrates a real product decision (bundle pricing)
rather than plumbing.

## The core problem: one price, many stations

A combo like _Set Nướng nhóm 4_ contains:

| Component            | Station | Cooked by      |
| -------------------- | ------- | -------------- |
| Ba chỉ bò nướng ×2   | GRILL   | grill cook     |
| Hàu nướng mỡ hành ×4 | GRILL   | grill cook     |
| Lẩu Thái (nhỏ) ×1    | HOTPOT  | hotpot station |
| Trà đào ×4           | DRINK   | bar            |

The guest pays **one** combo price. But the grill cook, the hotpot station and
the bar each need their own ticket for their share. So a combo cannot be a
single kitchen line — it must **fan out** into per-component work while
**billing sees one bundled line**.

### Why components must be real `order_items`

`kitchen_ticket_items.order_item_id` is **NOT NULL** (FK → `order_items`, ON
DELETE CASCADE). A kitchen ticket item cannot exist without a backing
`order_item`. Therefore every combo component that gets cooked **must** be a
real `order_item` row. A combo cannot live only on the parent line or only in
kitchen-land.

### The model: parent line + component lines

We introduce a **parent/child** relationship inside `order_items`:

- **Parent line** — one `order_item` per combo instance. Holds the combo
  **name snapshot** and the **fixed combo price** (`unit_price_vnd = combo
price`, `menu_item_id = NULL`, `combo_id = <combo def>`). It is **not
  cooked** — skipped from kitchen ticket building. It is what billing shows.
- **Component lines** — one `order_item` per combo component, each with
  `parent_order_item_id = <parent>`, its real `menu_item_id` / variant,
  `station` set, and **`unit_price_vnd = 0`** (price already captured on the
  parent). These are the rows the kitchen cooks and updates status on.

Billing sums `order_items.total_amount_vnd`: parent = combo price, components =
0 → order total is exactly the combo price. ✅ No double-charge, no split-share
rounding.

This reuses the **existing** `buildKitchenTickets` station-grouping in
`guest_place_order.go` unchanged in spirit — component lines already carry a
`Station`, so grouping by station fans them into the right tickets
automatically. The only change: **skip parent (combo) lines** when building
tickets.

Invariants preserved:

- **#2 Snapshot** — combo name + fixed price frozen on the parent line;
  component names/prices(0) frozen on child lines. Later combo edits never
  touch past orders.
- **#3 Per-item status** — each _component_ line has its own
  `PENDING→…→SERVED`; the parent's status is a **rollup** (see below).
- **#7 Guest no running total** — guest sees combo name + component dishes +
  status, never prices.

---

## Data model

### New table `combos`

```
id                   uuid PK
restaurant_id        uuid NOT NULL
code                 text NOT NULL            -- e.g. COMBO-NUONG-4
name                 text NOT NULL            -- "Set Nướng nhóm 4"
slug                 text NOT NULL
description          text
image_url            text
combo_price_vnd      bigint NOT NULL          -- fixed bundle price (VND int64)
status               text NOT NULL DEFAULT 'DRAFT'   -- DRAFT|PUBLISHED|ARCHIVED
availability_status  text NOT NULL DEFAULT 'AVAILABLE'
is_featured          boolean NOT NULL DEFAULT false
valid_from           timestamptz              -- nullable; NULL = always
valid_to             timestamptz              -- nullable; NULL = always (holiday windows)
display_order        int NOT NULL DEFAULT 0
created_by           uuid
updated_by           uuid
version              int NOT NULL DEFAULT 1
created_at           timestamptz NOT NULL DEFAULT now()
updated_at           timestamptz NOT NULL DEFAULT now()
deleted_at           timestamptz

UNIQUE (restaurant_id, code)
UNIQUE (restaurant_id, slug)
```

`valid_from`/`valid_to` deliberately give combos a **time window** — this is
how holiday / special-day set menus are expressed (Tết combo live only in the
window), and folds in the "discount for special days" idea the user raised
without touching the unused `discounts` table.

### New table `combo_items` (combo definition components)

```
id                    uuid PK
restaurant_id         uuid NOT NULL
combo_id              uuid NOT NULL  FK combos(id) ON DELETE CASCADE
menu_item_id          uuid NOT NULL  FK menu_items(id)
menu_item_variant_id  uuid           FK menu_item_variants(id)  -- nullable
quantity              int NOT NULL DEFAULT 1
display_order         int NOT NULL DEFAULT 0
created_at            timestamptz NOT NULL DEFAULT now()

INDEX (restaurant_id, combo_id)
```

A component may pin a specific **variant** (e.g. "Lẩu Thái — nhỏ"). Options
(spice level etc.) are **not** part of the combo definition MVP — components
are cooked with kitchen defaults; per-guest option customization inside a combo
is out of scope this batch.

### Alter `order_items` — parent/child link

```
ALTER TABLE order_items
  ADD COLUMN combo_id             uuid,   -- set on parent line; FK combos(id)
  ADD COLUMN parent_order_item_id uuid,   -- set on component lines; self-FK order_items(id)
  ADD COLUMN reference_price_vnd  bigint; -- parent only: à-la-carte total frozen at order time (for invoice savings)
```

- **Parent combo line:** `combo_id` set, `parent_order_item_id` NULL,
  `menu_item_id` NULL, `unit_price_vnd = combo_price`, `station` NULL,
  `reference_price_vnd` = Σ(component à-la-carte price × qty) captured now.
- **Component line:** `parent_order_item_id` set, `menu_item_id` set,
  `unit_price_vnd = 0`, `station` real.
- **Plain à-la-carte line (today):** both NULL — unchanged, zero behavior
  change for existing orders.

Self-FK: `parent_order_item_id REFERENCES order_items(id)`. Do **not** cascade
kitchen behavior through it; cancellation is handled in the application layer
(see cancel rules).

No change to `menu_item_id` nullability check needed — it's already nullable in
`order_items`.

---

## Domain (module: `catalog` for defs, `ordering` for placement)

Combo **definitions** are a catalog concern (they're menu content). Combo
**ordering / fan-out** is an ordering concern. Split accordingly.

### `catalog` domain

- `Combo` aggregate: header fields + `[]ComboComponent`
  (`menu_item_id, variant_id, quantity, display_order` + resolved snapshot
  name for display). Guest-facing read `ComboSummary` (name, image, featured,
  `combo_price_vnd`, `savings_vnd`) and `ComboDetail` (+ components with their
  dish names/images, no per-component price shown to guest).
- `savings_vnd` = Σ(component à-la-carte price × qty) − `combo_price_vnd`,
  computed at read time from **current** menu prices. **Display only on the
  live guest/admin menu**, never persisted there (à-la-carte prices drift). For
  the **invoice** — a frozen document — savings must NOT be recomputed from
  live prices; see Billing (a reference total is snapshotted at order time).

### `ordering` domain

`OrderLineCreate` gains combo awareness. Two shapes feed order building:

1. plain line (today) → one `OrderLineCreate`.
2. combo line → **one parent** `OrderLineCreate` (combo snapshot, fixed price,
   no station, `IsComboParent: true`, `ReferencePriceVND` = à-la-carte total
   snapshot — see billing) **+ N component**
   `OrderLineCreate` (`ParentRef` linking to the parent, `UnitPriceVND: 0`,
   real `Station`).

**`buildKitchenTickets` change — read carefully, this is where a silent bug
lives.** The real loop (verified in `guest_place_order.go`) is:

```go
for i, line := range lines {
    station := line.Station
    if station == "" { station = "GENERAL" }   // empty → GENERAL, load-bearing
    byStation[station] = append(byStation[station], i)  // i indexes the FULL lines slice
}
// ...
KitchenTicketCreate{ Station: station, ItemIndexes: byStation[station] }
```

`ItemIndexes` are **positional indexes into the full `lines` slice**. To skip
combo parents you MUST `continue` inside this loop when `line.IsComboParent` —
**never pre-filter or rebuild the slice**, or every ticket's `ItemIndexes`
point at the wrong `order_items`. The empty-station→`GENERAL` default means a
parent line that isn't skipped would silently land in a GENERAL ticket, so the
`continue` is correctness, not tidiness. Component lines flow through the
existing station map untouched → correct cross-station tickets.

**Insert ordering:** pre-generate every `order_item` UUID in Go (`uuid.New()`)
so parent + its children go in **one batch insert preserving slice order**,
and each child's `parent_order_item_id` references the pre-generated parent id.
A two-phase insert (parent, then children) would let the positional
`ItemIndexes` drift out of sync with the persisted rows — avoid it.

### Parent status rollup

Parent line status is **derived** from its component lines on read (not stored
as an independent lifecycle):

- any component `PENDING` → combo `PENDING`
- all `ACKNOWLEDGED+` and at least one `< SERVED` → combo `PREPARING`
- all `SERVED` → combo `SERVED`
- all `CANCELLED` → combo `CANCELLED`

Guest + waiter combo cards show this rollup plus the per-component breakdown.

---

## Application use-cases

### Guest — order a combo

Extend the existing `GuestPlaceOrder` request line to accept a combo:

```
PlaceOrderLineInput {
  menu_item_id?  string   // present for à-la-carte
  combo_id?      string   // present for combo   (exactly one of the two)
  variant_id?    string
  quantity       int      // number of combos (fans out ×quantity per component)
  note           string
  options        [...]    // à-la-carte only
}
```

On a `combo_id` line, `GuestPlaceOrder`:

1. Loads the combo def; validates PUBLISHED + within `valid_from/to` +
   `availability_status = AVAILABLE`. Reject stale/expired combo with
   `conflict`/`unprocessable`.
2. Builds the **parent** line: snapshot `name`, `code`, `unit_price_vnd =
combo_price × 1` per combo unit, `quantity` = requested combo qty,
   `subtotal/total = combo_price × qty`.
3. Builds **component** lines: for each `combo_item`, one `OrderLineCreate`
   with `quantity = combo_item.quantity × requested combo qty`, real station,
   `unit_price_vnd = 0`, `ParentRef → parent`, name/variant snapshot from the
   menu item.
4. Feeds all lines into the existing persist + `buildKitchenTickets` path.

`session_total_vnd` (staff/billing side) rises by exactly the combo price.
Guest response omits prices per rule #7.

### Guest — cancel / edit a combo

- **Atomic**: a combo is cancelled/edited **as a whole**, never per component.
- **`EditOrder` guard (mandatory):** the existing `EditOrder` use-case accepts
  a flat `order_item_id` and will happily let a guest change the quantity of a
  single component or the parent. It MUST **reject any line whose `combo_id` OR
  `parent_order_item_id` is non-null** (error e.g. `combo_not_editable` /
  `unprocessable`). "Out of scope" is not "blocked" — without this guard a
  guest silently mutates a combo component and the fixed-price parent no longer
  matches. Same guard on the **direct-cancel** path: cancelling a bare
  component line would orphan its parent, so direct-cancel of a combo must
  target the **parent** and cascade to components.
- While **all** component lines are `PENDING` → guest cancels the combo by its
  parent: cancel parent + all components in one tx.
- Once any component is `ACKNOWLEDGED+` → **cancel request** for the whole
  combo (kitchen approves/rejects), mirroring rule #4. On approve, cancel
  parent + all remaining components.
- Editing quantity of a component inside a combo is **out of scope** — change
  = cancel combo + re-add.

### Kitchen — one component unavailable

`order_items` has `unavailable_*` columns and the à-la-carte flow lets a cook
mark a single dish unavailable. For a combo this is a **billing hole**: the
fixed-price parent still charges the full bundle while a component silently
drops. Rule for MVP: **combo components CANNOT be individually marked
unavailable.** If a component can't be made, the kitchen cancels the **whole
combo** (cancel-request path above); the guest re-orders à la carte. A
component-level substitution/repricing flow is a deliberate follow-up, not this
batch. The unavailable action must be disabled/blocked server-side for any line
with a non-null `parent_order_item_id`.

### Admin — combo CRUD (gated `catalog.manage`)

Mirror batch-H item CRUD:

- `CreateCombo` — header + component list (each: menu_item_id, variant_id?,
  quantity). Validate every menu_item belongs to tenant + is not deleted.
  Server owns slug/code/version. Audit `catalog.combo_created`.
- `UpdateCombo` — header + replace components; optimistic `version`. Audit
  `catalog.combo_updated`.
- `DeleteCombo` — **soft delete** (`deleted_at`); never physical (order
  snapshots must stay intact). Audit `catalog.combo_deleted`.
- `ToggleComboAvailability` / publish `status` transitions.
- All emit outbox events for realtime menu invalidation.

### Read

- Guest: `ListCombos` (PUBLISHED, in-window, AVAILABLE) + `GetCombo` — with
  `savings_vnd` computed. Served under the guest session-token group alongside
  `/menu/*`.
- Admin: `ListCombosAdmin` (incl. DRAFT/ARCHIVED/expired) + `GetComboAdmin`
  (with `version`) under the `catalog.manage` group.

---

## Billing

**Verified against current code** (`billing_repository.go`):
`billableItems` selects every non-`CANCELLED` `order_item` and does **not**
skip zero-total rows, and `subtotal += TotalAmountVND`. So with parent =
combo_price and components = 0: components DO get snapshotted as `invoice_items`
(they render) and subtotal = combo price exactly. No code fights us here. Two
gaps: `insertInvoiceItem` hardcodes `item_type = 'MENU_ITEM'` and
`invoice_items` has no parent/child column — both need adding.

`BuildInvoice` snapshots the **parent** combo line as **one** invoice line
(combo name + fixed price) and the component lines (price 0) as **indented
sub-lines** (name + qty, no price):

```
Set Nướng nhóm 4                         550.000₫
   • Ba chỉ bò nướng ×2
   • Hàu nướng mỡ hành ×4
   • Lẩu Thái (nhỏ) ×1
   • Trà đào ×4
   (Tiết kiệm 90.000₫ so với gọi lẻ)     -- savings caption, see below
```

`invoice_items` mirrors `order_items`: add **`combo_id`** (set on the parent
line) + **`parent_invoice_item_id`** (self-FK, set on component lines). Extend
`item_type` to `'MENU_ITEM' | 'COMBO' | 'COMBO_COMPONENT'` so the PDF renderer
groups by parent. (Do NOT use the alternative `is_combo_component` +
`combo_line_group` shape — one shape only, mirror `order_items`.)

**Savings caption uses the frozen `reference_price_vnd`** carried on the parent
`order_item`, snapshotted to the parent `invoice_item`: `savings = reference −
combo_price`. It is NOT recomputed from live menu prices — snapshot rule #2
governs a printed invoice. If `reference_price_vnd` is absent (old data), omit
the caption rather than compute live.

Manual invoice discount (`AdjustInvoice`) is unaffected — it applies to the
invoice subtotal, which already includes combos at their fixed price.

---

## Frontend

### Guest ordering (`features/ordering`)

- **Combo cards** in the menu (own "Combo" section or interleaved with a
  distinct badge). Card shows combo name, image, **combo price**, and a
  **savings badge** ("Tiết kiệm 90.000₫"). This is consistent with rule #7:
  verified that the guest menu already renders per-item prices today
  (`menu-screen.tsx` → `formatVND(price)`), so rule #7 governs the **running
  total / bill**, not per-dish prices. A combo price + savings is promo
  framing, not a running total. **Normative — show the price and savings.**
- **Combo detail sheet**: lists component dishes (name + qty + image), "Thêm
  vào giỏ". Cart line = one combo entry; order status view shows the combo with
  its component status rollup + breakdown.
- Types: `ApiComboSummary`, `ApiComboDetail`, `PlaceOrderLineInput` gains
  optional `combo_id`.

### Kitchen (`features/kitchen`)

- Component lines already arrive as normal ticket items routed to their
  station — **no station-board change needed**. Optionally tag a ticket item
  with its combo name ("[Set Nướng 4] Ba chỉ bò ×2") so the cook sees it's part
  of a set. Requires threading combo name onto `kitchen_ticket_items` snapshot
  or the read DTO.

### Admin combo builder (`features/catalog`)

- New `/admin/catalog` sub-tab "Combos": list + create/edit sheet.
- Builder: header fields (name, price, image, validity window, featured) +
  **component picker** (search menu items → add with qty + optional variant).
  Live "à-la-carte total vs combo price → savings" preview.
- Delete via `SecureActionDialog` (high-impact), price/validity edits audited.
- i18n vi/en in `features/admin/data/i18n.ts`.

---

## RBAC / high-impact

- Guest combo read + order: guest session-token group (same as `/menu/*` and
  place-order).
- Admin combo CRUD: server-gated `catalog.manage` + FE permission tree. Create/
  edit price + delete are system-influencing → confirm-gate + audit per
  `high-impact-action-policy`.

---

## Build order

1. **Migration**: `combos`, `combo_items`; alter `order_items`
   (`combo_id`, `parent_order_item_id`); alter `invoice_items` (combo link).
   Verify no impact on existing order/invoice reads (both new cols nullable).
2. **Catalog combo domain + admin CRUD + reads** (repo, use-cases, handlers,
   audit, tests). Unblocks admin building combos + guest listing.
3. **Seed** a couple of demo combos in `cmd/seed` (e.g. COMBO-NUONG-4,
   COMBO-LAU-2) from the existing 51 items, so the flow is demoable.
4. **Ordering fan-out**: extend `GuestPlaceOrder` (parent + component lines),
   skip parent in `buildKitchenTickets`, parent status rollup on order reads.
   Tests: combo fans to correct stations; total = combo price; component status
   independent; cancel atomic (PENDING direct vs ACK cancel-request).
5. **Billing**: parent+component invoice snapshot; PDF grouped rendering.
6. **Frontend**: admin combo builder → guest combo cards/detail → kitchen combo
   tag → order-status rollup.
7. **Review (Claude)** → follow-ups: per-combo option customization, combo-level
   stock/limits, combo analytics.

## Resolved (verified against code, no longer open)

- **Savings/price on guest card** — guest menu already renders per-item prices
  (`menu-screen.tsx`), so rule #7 is about the running total/bill. Show price +
  savings. Normative.
- **Zero-price components on the invoice** — `billableItems` doesn't skip
  zero-total rows and `order_items` has no `unit_price_vnd > 0` CHECK, so
  components snapshot and render fine; subtotal = combo price.
- **Invoice savings drift** — solved by snapshotting `reference_price_vnd` at
  order time (not live recompute).

## Known consequence (accept + state, don't fix)

- **Revenue-by-dish undercounts combo components to zero.** Any report that
  sums `order_items` grouped by `menu_item_id` sees combo components at
  `unit_price_vnd = 0`, so per-dish revenue for dishes sold inside combos reads
  low; the revenue lands on the combo parent instead. Acceptable for the thesis
  scope — a combo-aware revenue report is a follow-up. Documented so a reviewer
  isn't surprised.

## Open questions for reviewer

- **Component variant/option customization** — MVP fixes components to combo
  defaults (no per-guest spice level inside a combo). Confirm acceptable for the
  thesis demo.
- **Combo inside partial payment / split-bill** — combo is one indivisible
  billing line; confirm split-bill (`split-bill.md`) treats it atomically
  (parent + children move together, never split across payers).
