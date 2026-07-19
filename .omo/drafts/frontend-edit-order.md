---
slug: frontend-edit-order
status: drafting
intent: clear
pending-action: write .omo/plans/frontend-edit-order.md
approach: Add backend Version field to GuestOrderDTO, frontend API call + edit sheet UI for PENDING items
---

# Draft: frontend-edit-order

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->

| id | outcome | status | evidence |
|---|---|---|---|
| backend: GuestOrderDTO.Version | Must expose version in view response so client can pass it to edit endpoint | active | `backend/internal/modules/ordering/application/guest_view_orders.go:59` maps without Version |
| frontend: API function `editGuestOrder` | New fetch wrapper for PUT /orders/:orderId/items | active | `frontend/src/features/ordering/api.ts:56` — no edit function exists |
| frontend: edit-order types | Request/response types for the edit endpoint | active | `frontend/src/features/ordering/types/index.ts:175` — GuestOrderDTO has no version |
| frontend: OrderItemEditSheet | Bottom-sheet editing UI for PENDING items | active | `frontend/src/features/ordering/components/order-status-screen.tsx` — read-only, no edit |
| frontend: i18n keys | Vietnamese + English strings for edit UI | active | `frontend/src/features/ordering/data/i18n/` — needs new keys |
| frontend: wire into OrderStatusScreen | Show edit trigger on PENDING items, connect sheet | active | `order-status-screen.tsx:22` — no edit controls |

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->

| assumption | adopted default | rationale | reversible? |
|---|---|---|---|
| Edit UX pattern | Tap PENDING item → opens bottom sheet with quantity stepper + note field | Matches existing CartSheet and ItemDetail patterns; consistent UX | Yes — can switch to inline stepper later |
| Options editing in MVP | Read-only display of current options; user cannot change options during edit | Full option editing requires re-fetching menu item option groups + group rule validation; big scope for MVP | Yes — can add later |
| Cancel v. Edit | Delete button removes item; quantity=0 removes item; Save with changes updates | Backend interprets "present in order but absent in request" as cancel; "present with new qty" as edit | No — matches backend semantics exactly |
| Item opening behavior | Tap anywhere on item row opens edit sheet | No dedicated edit button needed; matches mobile UX conventions | Yes |

## Findings (cited - path:lines)

**Backend API - PUT /orders/:orderId/items:**
- Route: `backend/internal/modules/ordering/interfaces/http/handler.go:57` — `r.PUT("/orders/:orderId/items", h.guestEditOrder)`
- Request struct: `backend/internal/modules/ordering/application/guest_edit_order.go:15-26` — `GuestEditOrderRequest` with `Version int` + `Items []GuestEditOrderLineRequest`
- Each item: `GuestEditOrderLineRequest{OrderItemID, Quantity, Note, Options}`
- Response: `GuestOrderMutationResponse` with `OrderID, OrderNumber, Version, Status, Items, SessionTotalVND`
- Error format: `LineOperationError` with per-line `LineError{Index, MenuItemID, Reason}`

**Version gap:**
- `backend/internal/modules/ordering/domain/model.go:128-133` — `OrderRead` has `Version int`
- `backend/internal/modules/ordering/application/guest_view_orders.go:59` — `GuestOrderDTO` mapping OMITS Version
- `backend/internal/modules/ordering/application/guest_edit_order.go:80` — Edit requires `req.Version != order.Version` check
- **Fix needed**: Add `Version` to backend `GuestOrderDTO` and map it

**Frontend current:**
- `frontend/src/features/ordering/api.ts:54-55` — has `fetchGuestOrders(sessionToken)` but no edit function
- `frontend/src/features/ordering/types/index.ts:175-183` — `GuestOrderDTO` has no `version` field
- `frontend/src/features/ordering/components/order-status-screen.tsx:22-153` — read-only display, no edit affordance
- `frontend/src/features/ordering/hooks/use-ordering.tsx` — cart reducer has UPDATE_CART_LINE / REMOVE_CART_LINE but only for local pre-submit cart
- i18n patterns: `frontend/src/features/ordering/data/i18n/vi.ts` + `en.ts` — key:value per language, parity-checked

## Decisions (with rationale)

1. **Backend: Add Version to GuestOrderDTO** — minimal change, unblocks edit flow. No new migration needed.
2. **Frontend API: Reuse `apiRequest` with sessionToken** — matches all existing guest endpoints (`frontend/src/lib/api.ts`). No new auth pattern.
3. **Edit sheet: bottom sheet matching CartSheet style** — consistent with existing mobile-first UX (radix sheet + backdrop blur).
4. **No option/variant editing in MVP** — options require re-fetching menu item + group validation, 3x the scope. Quantity + cancel covers 90% of guest needs.
5. **No API version field in view response = bug** — backend must add it. Without version, guest cannot pass optimistic-lock check.

## Scope IN

- Backend: Add `Version` field to `GuestOrderDTO` in `guest_view_orders.go` and map it
- Frontend types: Add `version` to `GuestOrderDTO`, add edit request/response types
- Frontend API: Add `editGuestOrder(sessionToken, orderId, version, items)` to `api.ts`
- Frontend i18n: Add keys (vi + en) for edit UI
- Frontend component: `OrderItemEditSheet` — bottom sheet with:
  - Item name + image display
  - Quantity stepper (+/-), min 0 (which = delete)
  - Note text field (editable)
  - Current options summary (read-only)
  - Save button
  - Delete button
- Frontend: Wire edit trigger into `OrderStatusScreen` — tap PENDING item row opens sheet
- Frontend: Wire save → call API → invalidate query → refetch → close sheet + toast
- Frontend: Wire delete → omit from items array → save triggers backend cancel

## Scope OUT (Must NOT have)

- No option/variant editing (only quantity + note)
- No edit of ACKNOWLEDGED+ items (backend locks them anyway)
- No "edit whole order" page (separate from item-level edit)
- No cancel-request UI for PREPARING+ items (separate feature, uses GuestRequestCancel)
- No bulk edit (one item at a time)
- No drag-to-reorder
- No version conflict recovery UX beyond "reload the page" toast
- No backend changes beyond the Version field addition
- No table merging (out of scope entirely)

## Open questions

None — all findings resolved through code exploration. One fork was edit UX pattern (inline vs sheet), resolved via default to sheet to match existing patterns.

## Approval gate
status: awaiting-approval
plan-file: .omo/plans/frontend-edit-order.md
