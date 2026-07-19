# Plan: Out-of-Stock → Substitute Dish

## Problem

Kitchen runs out of ingredients for a menu item. A guest already ordered that item (PENDING/ACKNOWLEDGED). The system must:

1. Let kitchen/server mark the item as **unavailable** (out of stock)
2. **Push a real-time notification** to the guest who ordered it
3. Let the guest **tap to choose a substitute dish** (replacement)
4. The substitute is placed as a **new order item** via the existing place-order flow

---

## Current State

| Aspect | Status |
|---|---|
| **Domain statuses** | `PENDING → ACKNOWLEDGED → PREPARING → READY → SERVED` + `CANCELLED` in DB. No `UNAVAILABLE`. |
| **Staff status update** | `StaffUpdateItemStatus` moves items forward. `validStaffStatus()` allows only the 5 forward statuses. |
| **Real-time outbox** | `StaffUpdateItemStatus` writes `ordering.item_status_updated` → dispatcher broadcasts to WebSocket hub. Works for any event type. |
| **Frontend real-time** | `RealtimeProvider` connects WebSocket; on `ordering.*` events, invalidates `guest-orders` query → TanStack Query refetches. |
| **Guest order screen** | `OrderStatusScreen` renders items with `STATUS_COLORS` map. `PENDING` items show an edit (pencil) button. |
| **i18n status labels** | `status_pending`, `status_confirmed`, `status_preparing`, `status_ready`, `status_served`, `status_cancelled`. No `status_unavailable`. |
| **Order API route** | `POST /api/v1/customer/orders` = `guestPlaceOrder` (exists, works independently) |

---

## Implementation Plan

### 1. Domain — add UNAVAILABLE status + transition

**File**: `backend/internal/modules/ordering/domain/model.go`

- Add `StatusUnavailable OrderItemStatus = "UNAVAILABLE"` constant
- Add transition: `StatusPending: {StatusAcknowledged, StatusUnavailable}` and `StatusAcknowledged: {StatusPreparing, StatusUnavailable}`
- `UNAVAILABLE` is a **terminal** status (no transitions out)

### 2. Application — StaffMarkUnavailable use case

**New file**: `backend/internal/modules/ordering/application/staff_mark_unavailable.go`

```go
type StaffMarkUnavailable struct {
    tx                  TxRunner
    repo                StaffReadRepository
    outbox              domain.OutboxWriter
    defaultRestaurantID uuid.UUID
}

type MarkUnavailableRequest struct {
    Reason string `json:"reason,omitempty"`
}

type MarkUnavailableResponse struct {
    ItemID    uuid.UUID `json:"item_id"`
    Status    string    `json:"status"`
}
```

**`Handle(ctx, itemID uuid.UUID, reason string, actorID *uuid.UUID, actorRole string)`**:
1. Validate actor has kitchen/server role
2. Read current item from repo; verify it's PENDING or ACKNOWLEDGED
3. Call `repo.MarkItemUnavailable(ctx, restaurantID, itemID, reason, actorID)`
4. Write outbox event with **`SessionID`** in payload (so real-time can route to the specific guest)
   - Event type: `ordering.item_unavailable`
   - Payload: `{ item_id, order_id, session_id, reason }`

**Modify**: `backend/internal/modules/ordering/application/staff_views.go`
- Update `validStaffStatus()` to NOT include `StatusUnavailable` — unavailable is set via the dedicated use case, not via the generic status update route

### 3. DB — migration

**New file**: `backend/migrations/00006_out_of_stock_status.sql`

```sql
-- Add UNAVAILABLE to order_items status check
ALTER TABLE order_items DROP CONSTRAINT chk_order_items_status;
ALTER TABLE order_items ADD CONSTRAINT chk_order_items_status
    CHECK (status IN ('PENDING','ACKNOWLEDGED','PREPARING','READY','SERVED','CANCELLED','UNAVAILABLE'));

-- Add unavailable tracking columns
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unavailable_at TIMESTAMPTZ;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unavailable_reason VARCHAR(255);
```

### 4. Repository — implement MarkItemUnavailable

**File**: `backend/internal/modules/ordering/infrastructure/postgres/staff_repo.go` (or wherever the repo implementation lives)

- Add `MarkItemUnavailable(ctx, restaurantID, itemID, reason, actorID)` method
- SQL: `UPDATE order_items SET status = 'UNAVAILABLE', unavailable_at = NOW(), unavailable_reason = $1, ... WHERE id = $2 AND restaurant_id = $3 AND status IN ('PENDING', 'ACKNOWLEDGED') AND deleted_at IS NULL`
- Return the updated item DTO

**Add to `StaffReadRepository` interface** in the domain package.

### 5. HTTP — staff route

**File**: `backend/internal/modules/ordering/interfaces/http/handler.go`

- Add `StaffMarkUnavailable *application.StaffMarkUnavailable` to `Handler` struct
- Add `StaffUpdateStatus` → rename field or keep separate for clarity
- Add handler `staffMarkUnavailable`:
  - `POST /api/v1/restaurant/order-items/:itemId/unavailable`
  - Body: `{ "reason": "hết thịt bò" }`
- Register route in `RegisterStaffRoutes` alongside existing `PATCH .../status`

**Wiring in `cmd/api/main.go`**:
- Construct `StaffMarkUnavailable` with same deps as `StaffUpdateItemStatus`
- Pass to `orderingHandler.NewHandler(...)` (add parameter to `NewHandler`)

### 6. Outbox event → frontend real-time propagation

**No code change needed for outbox dispatcher or WebSocket hub** — they already broadcast any outbox event type via `hub.Broadcast` to all topics.

The `RealtimeProvider` already invalidates `guest-orders` on `ordering.*` events. The new event type `ordering.item_unavailable` matches `type.startsWith('ordering.')` → invalidation works automatically.

However, add a more **targeted invalidation key** so the guest's specific `guest-orders/{sessionToken}` gets refetched:

**File**: `frontend/src/lib/realtime.tsx`

- Add a handler map for `ordering.item_unavailable` that also invalidates `['guest-orders']` (already covered by the `type.startsWith('ordering.')` branch)
- Optionally, add `session_id` to the event payload so the frontend could be even more selective

### 7. Frontend — OrderItemDTO: add `unavailable_reason` field

**File**: `frontend/src/features/ordering/types/index.ts`

```typescript
export interface OrderItemDTO {
  // ... existing fields
  unavailable_reason?: string  // new
}
```

If the backend DTO already returns `unavailable_reason` as null when not set, this is optional on the frontend.

### 8. Frontend — i18n: add UNAVAILABLE labels

**File**: `frontend/src/features/ordering/data/i18n/vi.ts`
```typescript
status_unavailable: 'Hết nguyên liệu',
unavailable_reason: 'Lý do',
choose_other_dish: 'Chọn món khác',
toast_item_unavailable: 'Món đã hết nguyên liệu'  // for toast if needed
```

**File**: `frontend/src/features/ordering/data/i18n/en.ts`
```typescript
status_unavailable: 'Out of stock',
unavailable_reason: 'Reason',
choose_other_dish: 'Choose another dish',
toast_item_unavailable: 'Item is out of stock'
```

### 9. Frontend — OrderStatusScreen: render UNAVAILABLE state

**File**: `frontend/src/features/ordering/components/order-status-screen.tsx`

- Add `UNAVAILABLE` to `STATUS_COLORS`:
  ```typescript
  UNAVAILABLE: 'bg-system-red/15 text-system-red'
  ```
  (or a distinct color like gray/amber)

- In `OrderItemRow`, add logic:
  - If `item.status === 'UNAVAILABLE'`:
    - Show reason text (`Lý do: ...`) below the item name
    - Show a **"Chọn món khác"** button instead of the edit pencil
    - The button navigates to menu (or opens a bottom sheet with menu items)
    - The item name/quantity is still displayed but visually muted (e.g., line-through or lower opacity)

- Add `UNAVAILABLE` to the `onEdit` condition: currently only PENDING items are editable. UNAVAILABLE items should also get an action, but a different one ("chọn món khác" instead of edit pencil).

### 10. Frontend — "Choose another dish" flow

When guest taps "Chọn món khác":

**Option A (simpler, recommended)**: Navigate to menu screen (`dispatch({ type: 'SET_SCREEN', payload: 'menu' })`). Guest browses and places a new order using the existing `GuestPlaceOrder` flow. The UNAVAILABLE item stays as-is for record-keeping. Guest just orders the replacement normally.

**Option B (more complex)**: Open a dish-picker bottom sheet filtered to the same category, then auto-submit the replacement order. Not necessary for v1.

**Recommendation**: Option A. The existing "Đặt thêm món" button at the bottom already does this. For UNAVAILABLE items, we just add another entry point to the same flow — no new ordering logic needed.

---

## Edge Cases & Business Rules

| Scenario | Handling |
|---|---|
| **Item already PREPARING+** | Cannot mark unavailable — kitchen already cooking; must cancel via cancel-request flow if needed |
| **Multiple guests same session** | The real-time event goes to all guests in that session via WebSocket (one browser per guest). Each `guest-orders` refetches independently. |
| **Item already CANCELLED** | No-op; skip, return error |
| **Guest doesn't choose a replacement** | That's fine — the UNAVAILABLE item stays in the order record; no forced replacement |
| **Guest already paid (AWAITING_PAYMENT/CLOSED session)** | Block — session must be ACTIVE for the kitchen to mark items |
| **Reason is long** | `unavailable_reason` column is VARCHAR(255); frontend truncates display if > 80 chars |
| **Substitute costs different** | Guest places a new order at current menu price; the old item's snapshot is unaffected. No price adjustment needed — they're two separate transactions |

---

## Files Changed (Summary)

### Backend (6 files)
| File | Change |
|---|---|
| `backend/internal/modules/ordering/domain/model.go` | + `StatusUnavailable`, + transitions |
| `backend/internal/modules/ordering/application/staff_mark_unavailable.go` | **New** — use case |
| `backend/internal/modules/ordering/application/staff_views.go` | Update `validStaffStatus()` |
| `backend/internal/modules/ordering/domain/repository.go` | Add `MarkItemUnavailable` to `StaffReadRepository` |
| `backend/internal/modules/ordering/infrastructure/postgres/staff_repo.go` | Implement `MarkItemUnavailable` |
| `backend/internal/modules/ordering/interfaces/http/handler.go` | + route, + handler method |
| `backend/cmd/api/main.go` | Wire new use case |
| `backend/migrations/00006_out_of_stock_status.sql` | **New** — migration |

### Frontend (4 files)
| File | Change |
|---|---|
| `frontend/src/features/ordering/types/index.ts` | + `unavailable_reason` field |
| `frontend/src/features/ordering/data/i18n/vi.ts` | + status label + UI strings |
| `frontend/src/features/ordering/data/i18n/en.ts` | + status label + UI strings |
| `frontend/src/features/ordering/components/order-status-screen.tsx` | + UNAVAILABLE color/label, + "Chọn món khác" button |

---

## Verification

1. `make verify` (backend build+vet+test + frontend build) — must pass
2. Manual API test: `POST /api/v1/restaurant/order-items/:id/unavailable` with a PENDING item → status becomes UNAVAILABLE, outbox event written
3. Manual frontend test: guest order screen shows UNAVAILABLE badge + "Chọn món khác" button → tap → menu screen opens
4. Real-time test: in two browser tabs (guest + kitchen), mark item unavailable → guest tab shows updated status without page refresh
