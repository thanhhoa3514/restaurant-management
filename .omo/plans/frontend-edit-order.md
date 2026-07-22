# frontend-edit-order - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** Guest can tap on any PENDING dish they've already ordered, change the quantity or remove it via a bottom-sheet UI. No need to call staff for simple changes.

**Why this approach:** Backend already supports editing — only the frontend is missing. A bottom sheet matches the existing cart UI, so the pattern is familiar.

**What it will NOT do:** No editing options/variants (read-only display). No editing after kitchen starts cooking. No merging tables.

**Effort:** Short
**Risk:** Low — backend is complete, frontend patterns exist in the same folder
**Decisions to sanity-check:** Version field gap in backend DTO needs a 2-line fix.

Your next move: approve this plan, then I'll implement. Full execution detail follows below.

---

> TL;DR (machine): Short, Low. 6 todos: 1 backend fix (version field) + 5 frontend (types, api, i18n, edit sheet component, wire into order-status-screen).

## Scope
### Must have
- Guest can see a tappable "edit" affordance on PENDING items in the order-status screen
- Guest can change quantity (+/-) of a PENDING item
- Guest can delete a PENDING item
- Guest can edit the note on a PENDING item
- API error feedback shown as toast on failure

### Must NOT have (guardrails, anti-slop, scope boundaries)
- No option/variant editing in edit sheet (current options shown read-only)
- No editing of ACKNOWLEDGED+ items
- No cancel-request UI for PREPARING+ items
- No bulk-edit (one item at a time via bottom sheet)
- No backend changes beyond adding Version to GuestOrderDTO
- No new routes or mutations — only the existing PUT /orders/:orderId/items and DELETE /orders/:orderId
- No version-conflict resolution beyond "order was modified, reload" toast

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after. Manual verification via `npm run build` + `tsc -b` + visual inspection since this is pure UI work.
- Evidence: .omo/evidence/ (build output, lint results)

## Execution strategy
### Parallel execution waves
> Single wave — all 6 todos are sequential (each depends on the prior).

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1. Backend: Version field | — | 2 | — |
| 2. Frontend: Types | 1 | 3 | — |
| 3. Frontend: API function | 2 | 5,6 | 4 |
| 4. Frontend: i18n keys | — | 6 | 1,2,3 |
| 5. Frontend: EditSheet component | 3 | 6 | 4 |
| 6. Frontend: Wire into OrderStatusScreen | 4,5 | — | — |

## Todos
> Implementation + verification = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [ ] 1. Backend: Add Version field to GuestOrderDTO and map it in GuestViewOrders response
  What to do / Must NOT do:
    - In `backend/internal/modules/ordering/application/guest_view_orders.go`:
      - Add `Version int \`json:"version"\`` to `GuestOrderDTO` struct
      - In `Handle()` line 59, add `Version: order.Version,` to the GuestOrderDTO literal
    - Must NOT change any other backend file, must NOT run migration
  Parallelization: Wave 1 | Blocked by: — | Blocks: 2
  References (executor has NO interview context - be exhaustive):
    - File: `backend/internal/modules/ordering/application/guest_view_orders.go`
    - Struct GuestOrderDTO at line 19-27 — currently has: ID, OrderNumber, OrderType, Status, SubmittedAt, Note, Items
    - Handle() at line 38-61 — response mapping, the GuestOrderDTO literal at line 59
    - GuestEditOrder at `backend/internal/modules/ordering/application/guest_edit_order.go:80` requires `req.Version` to match `order.Version`
    - Domain `OrderRead` at `backend/internal/modules/ordering/domain/model.go:128-133` already has `Version int`
  Acceptance criteria (agent-executable):
    - `grep "Version" backend/internal/modules/ordering/application/guest_view_orders.go` shows Version in GuestOrderDTO + mapped in Handle
    - `cd backend && go build ./...` exits 0
    - `cd backend && go vet ./...` exits 0
  QA scenarios (name the exact tool + invocation): happy = `go build ./... && go vet ./...` and `go test ./internal/modules/ordering/... -count=1` pass. Evidence `.omo/evidence/task-1-build.log`
  Commit: N (all changes in one commit at the end)

- [ ] 2. Frontend types: Add version + edit-order request/response types
  What to do / Must NOT do:
    - In `frontend/src/features/ordering/types/index.ts`:
      - Add `version: string` to `GuestOrderDTO` (JSON from backend is number, but frontend convention uses string for IDs; version is numeric so use `number`)
      - Actually backend sends `"version": 1` (int). Use `version: number` in frontend.
      - Add `EditOrderOptionInput { option_id: string; quantity: number }`
      - Add `EditOrderLineInput { order_item_id: string; quantity: number; note: string; options: EditOrderOptionInput[] }`
      - Add `EditOrderInput { version: number; items: EditOrderLineInput[] }`
      - The `GuestOrdersResponse` already has `session_total_vnd: number` — no change needed
      - The response from edit endpoint matches `GuestOrdersResponse` shape but per-order. Reuse existing `PlaceOrderResult` for now (it has `order_id, order_number, order_type, items, session_total_vnd`) — or add dedicated `EditOrderResult` type
    - Must NOT touch any other frontend file
  Parallelization: Wave 1 | Blocked by: 1 (need Version confirmed in backend response) | Blocks: 3
  References:
    - `frontend/src/features/ordering/types/index.ts:175-183` — GuestOrderDTO
    - `frontend/src/features/ordering/types/index.ts:185-188` — GuestOrdersResponse
    - Backend `GuestEditOrderRequest` at `backend/internal/modules/ordering/application/guest_edit_order.go:15-26` — request shape to mirror
    - Backend `GuestOrderMutationResponse` at `guest_edit_order.go:28-36` — response shape
  Acceptance criteria (agent-executable):
    - `tsc -b --noEmit` passes in frontend/
    - Types are importable
  QA scenarios: happy = `cd frontend && npx tsc --noEmit` passes. Evidence `.omo/evidence/task-2-tsc.log`
  Commit: N

- [ ] 3. Frontend API: Add editGuestOrder function to api.ts
  What to do / Must NOT do:
    - In `frontend/src/features/ordering/api.ts`:
      - Add import for new types: `EditOrderInput, EditOrderResult`
      - Add function:
        ```typescript
        export function editGuestOrder(
          sessionToken: string,
          orderId: string,
          input: EditOrderInput,
        ): Promise<EditOrderResult> {
          return apiRequest<EditOrderResult>(`/api/v1/customer/orders/${orderId}/items`, {
            method: 'PUT',
            body: input,
            sessionToken,
          })
        }
        ```
      - The `apiRequest` automatically attaches `X-Session-Token` header when `sessionToken` is passed
      - It also unwraps the `{ data: ..., error: ... }` envelope and throws `ApiError` on failure
    - Must NOT add duplicate fetch calls, must NOT use raw `fetch`
    - Must NOT remove or modify existing functions
    - Must NOT route through staff JWT (this is a guest endpoint)
  References:
    - `frontend/src/features/ordering/api.ts:43-50` — `placeGuestOrder` as reference pattern (same sessionToken auth, same method signature style)
    - `frontend/src/lib/api.ts` — `apiRequest()` signature: `<T>(url, { method?, body?, sessionToken? }) => Promise<T>`
  Acceptance criteria (agent-executable):
    - `tsc -b --noEmit` passes
    - Function is exported and importable
  QA scenarios: happy = `cd frontend && npx tsc --noEmit` passes. Evidence `.omo/evidence/task-3-tsc.log`
  Commit: N

- [ ] 4. Frontend i18n: Add Vietnamese + English keys for edit UI
  What to do / Must NOT do:
    - In `frontend/src/features/ordering/data/i18n/vi.ts`:
      - Add after `confirm_order` (line 58):
        - `edit_item: 'Chỉnh sửa món'`
        - `save: 'Lưu'`
        - `delete_item: 'Xoá món'`
        - `toast_order_edited: 'Đã cập nhật món'`
        - `toast_item_removed: 'Đã xoá món'`
        - `delete_last_item_confirm: 'Đây là món cuối cùng. Xoá toàn bộ đơn hàng?'`
        - `order_modified_reload: 'Đơn hàng đã thay đổi. Đang tải lại...'`
    - In `frontend/src/features/ordering/data/i18n/en.ts`:
      - Same keys with English values:
        - `edit_item: 'Edit item'`
        - `save: 'Save'`
        - `delete_item: 'Remove item'`
        - `toast_order_edited: 'Order updated'`
        - `toast_item_removed: 'Item removed'`
        - `delete_last_item_confirm: 'This is the last item. Delete entire order?'`
        - `order_modified_reload: 'Order was modified. Reloading...'`
    - Must NOT change existing keys, must NOT break the parity-check `type _KeyParity`
    - Both files use `as const` — the new entries should follow the same pattern
  References:
    - `frontend/src/features/ordering/data/i18n/vi.ts` — full file, patterns at lines 46-49 (toast patterns) and 50-57 (action labels)
    - `frontend/src/features/ordering/data/i18n/en.ts` — mirror of vi.ts
    - `frontend/src/features/ordering/data/i18n.ts` — parity check between vi and en keys
  Acceptance criteria (agent-executable):
    - `tsc -b --noEmit` passes (parity check catches drift)
    - Keys exist in both files
  QA scenarios: happy = `cd frontend && npx tsc --noEmit` passes. Evidence `.omo/evidence/task-4-tsc.log`
  Commit: N

- [ ] 5. Frontend component: Create OrderItemEditSheet bottom sheet
  What to do / Must NOT do:
    - Create new file `frontend/src/features/ordering/components/order-item-edit-sheet.tsx`
    - Props: `item: OrderItemDTO`, `orderId: string`, `open: boolean`, `onClose: () => void`, `lang: Lang`, `sessionTotal: number`
    - Component structure:
      - Backdrop overlay (matching CartSheet pattern: `fixed inset-0 bg-black/60 backdrop-blur-sm z-[...]`)
      - Bottom sheet panel (`fixed bottom-0 left-0 right-0 rounded-t-[32px]` matching CartSheet style)
      - Header: item name + close button
      - Body:
        - Item image + name display
        - Current options display (read-only list of `item.options` from OrderItemDTO)
        - Note textarea (pre-filled with item's note from order — but wait, OrderItemDTO doesn't have a `note` field per-item... check the backend)
        - Quantity stepper: +/- buttons with current quantity, min 0 (show delete confirmation), max reasonable limit
      - Footer:
        - "Delete item" button (red, with confirmation)
        - "Save" primary button
    - Quantity logic:
      - Track local state `const [qty, setQty] = useState(item.quantity)`
      - If user clicks - when qty=1 → show toast "Item will be removed" vs immediate delete
      - On Save: construct `EditOrderInput` with current version (passed from parent), items array with edited item
    - Delete item logic:
      - If this is the ONLY item in the order → confirm "delete entire order?"
      - If there are other items → omit from edit request → backend cancels it
    - Style & UX:
      - Follow exact same visual patterns as CartSheet (backdrop blur, rounded-32, shadow-2xl, transition classes, font sizes, color variables)
      - Use the same `var(--bg)`, `var(--text)`, `var(--system-blue)`, `var(--system-red)` variables
      - Use `lucide-react` icons: `Plus, Minus, Trash2, Save, X`
      - Import `cn` from `@/lib/utils`
      - Import `formatVND` from `../helpers`
    - Must NOT:
      - Add any new Radix/shadcn dependency — use existing patterns only
      - Import from outside the ordering feature (except `@/lib/utils`, `@/lib/api`)
      - Handle loading/error states internally — errors propagate via toast from parent (Todo 6)
    - Known limitation: OrderItemDTO does not have a `note` field. The edit payload supports note, but we can't pre-fill it from current order data. Set note to `""` which will clear existing notes. To preserve existing notes, backend `OrderRead` would need to expose `item.note`. This is a pre-existing gap. For now, pass empty note — the backend will treat it as clearing the note. (Document this as known limitation.)
  References:
    - `frontend/src/features/ordering/components/cart-sheet.tsx` — full UX reference (backdrop, panel, button patterns, transition classes)
    - `frontend/src/features/ordering/components/order-status-screen.tsx` — parent that will render this component
    - `frontend/src/features/ordering/types/index.ts:152-165` — OrderItemDTO shape
  Acceptance criteria (agent-executable):
    - `tsc -b --noEmit` passes
    - Component renders in isolation without error
  QA scenarios: happy = `cd frontend && npx tsc --noEmit` passes. Evidence `.omo/evidence/task-5-tsc.log`
  Commit: N

- [ ] 6. Frontend integration: Wire edit flow into OrderStatusScreen
  What to do / Must NOT do:
    - In `frontend/src/features/ordering/components/order-status-screen.tsx`:
      - Add state: `const [editingItem, setEditingItem] = useState<{item: OrderItemDTO; orderId: string; version: number; sessionTotal: number} | null>(null)`
      - Add toggle: `const [editingOrderId, setEditingOrderId] = useState<string | null>(null)`
      - In each order section's item list: for PENDING items (`item.status === 'PENDING'`), wrap the row in a clickable button that sets `editingItem`
        - For non-PENDING items, keep current read-only display (no click)
        - Visual hint: on PENDING items, add a small chevron or edit icon to indicate tapability
      - Import and render `<OrderItemEditSheet>` at bottom of the component (inside the wrapping div but after the orders list)
      - On save from edit sheet:
        - Call `editGuestOrder(sessionToken, editingItem.orderId, editInput)`
        - On success: `invalidateQueries(['guest-orders', sessionToken])`, `toast.success(t.toast_order_edited)`, close sheet, refetch menu items
        - On error: if `ApiError` with message containing "line edit failed" or "conflict" → show specific Vietnamese/English message
        - On version conflict: `toast.error(t.order_modified_reload)` + refetch orders
      - On delete:
        - If last item → confirm dialog (simple `window.confirm` with `t.delete_last_item_confirm`)
          - If confirmed → call `DELETE /orders/:orderId` — but there's no deleteOrder API function. Need to add one OR handle it via edit with empty items (which backend rejects). Better: show message "Ask staff to cancel" or add a simple delete function.
          - ACTUALLY: There IS a `DELETE /orders/:orderId` route in backend (handler.go line 58: `r.DELETE("/orders/:orderId", h.guestCancelOrder)`). The handler cancels the whole order. So add a small helper: `cancelGuestOrder(sessionToken, orderId)` calling `DELETE /api/v1/customer/orders/${orderId}`.
          - Add this function to `api.ts` following the same pattern as other guest functions.
        - If not last item → omit from items array → call `editGuestOrder` with remaining items
      - Import needed items: `useState` (already imported), `toast` from `sonner` (already imported in cart-sheet, verify pattern), `editGuestOrder` from `'../api'`, `OrderItemEditSheet` from `'./order-item-edit-sheet'`, `Trash2` or `Pencil` icon from `lucide-react`
    - Must NOT:
      - Change the structure of existing order display
      - Break the existing order-more button or navigation
      - Remove Suspense boundaries or query hooks
      - Add any new dependencies
    - Also in `frontend/src/features/ordering/api.ts`:
      - Add `cancelGuestOrder(sessionToken, orderId)` function for the "delete last item" case
  References:
    - `frontend/src/features/ordering/components/order-status-screen.tsx` — full file
    - `frontend/src/features/ordering/api.ts` — add cancelGuestOrder here
    - Backend DELETE route: `backend/internal/modules/ordering/interfaces/http/handler.go:58` — `r.DELETE("/orders/:orderId", h.guestCancelOrder)`
    - Backend handler: `handler.go:115-127` — reads orderId from URL param, no request body
  Acceptance criteria (agent-executable):
    - `tsc -b --noEmit` passes
    - PENDING items show edit affordance (clickable with visual hint)
    - Non-PENDING items remain read-only
    - Edit sheet opens/closes correctly
    - Save triggers API call, invalidates query
  QA scenarios: happy = `cd frontend && npx tsc --noEmit` passes. Evidence `.omo/evidence/task-6-tsc.log`
  Commit: N

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE.

- [ ] F1. Build verification: `cd backend && go build ./... && go vet ./...` + `cd frontend && npm run build` — both exit 0
- [ ] F2. Plan compliance: All 6 todos implemented, no scope creep (no option editing, no backend changes beyond Version field)
- [ ] F3. Lint: `cd frontend && npm run lint` exits 0
- [ ] F4. Manual QA: Visual check of OrderStatusScreen with edit sheet open/close, quantity changes, delete flow

## Commit strategy
Single commit: `feat(frontend): add edit-order UI for PENDING items`

Contains all 6 todos + build verification. No separate commits.

## Success criteria
- Guest can tap any PENDING item on order-status screen
- Bottom sheet opens with quantity stepper, note field, save + delete buttons
- Changing quantity → PUT request → order updated → toast success
- Deleting item → PUT with remaining items → item cancelled → toast success
- Deleting last item → DELETE request → order cancelled → toast success
- Non-PENDING items show no edit affordance
- Build passes (`go build ./... && go vet ./... && npm run build`)
