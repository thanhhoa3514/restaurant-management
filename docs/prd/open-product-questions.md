# Resolved Product Decisions — Restaurant QR Ordering System

This document records the resolved design, business logic, and operational decisions for the Restaurant QR Ordering System MVP. These alignments guide both frontend and backend development.

---

## ⚖️ Resolved Product Decisions

### 1. Menu Prices Visibility & Totals (Q1)
*   **Decision**: **Fully Visible**.
*   **Behavior**: Guests can see prices of individual menu items, configured options, and the running total (running total) of all ordered items in their active session.
*   **Rationale**: Ensures maximum transparency, builds consumer trust, and helps guests self-manage their budget during multi-round ordering.

### 2. Invoice Scoping & Checkout Behavior (Q2)
*   **Decision**: **Bill from `ACKNOWLEDGED` onwards**.
*   **Behavior**: 
    *   Invoices charge for all items that reached at least the `ACKNOWLEDGED` (Accepted by kitchen) status (i.e., `ACKNOWLEDGED`, `PREPARING`, `READY`, `SERVED`).
    *   Any items remaining in the `PENDING` state at checkout will be auto-cancelled by the system or flagged for staff removal.
    *   If a guest cancels an `ACKNOWLEDGED` or later item, it is charged at 100% price (marked as `CHARGED_CANCEL`) unless a kitchen/staff member manually approves a waiver.
*   **Rationale**: Matches actual restaurant operations where prepared/in-prep items incur costs and must be paid for.

### 3. Kitchen Cancellation Approval Rules (Q3)
*   **Decision**: **Two-Tier Cancellation (Free vs. Charged)**.
*   **Behavior**: If a guest requests cancellation after kitchen acceptance (`ACKNOWLEDGED`+), the kitchen staff evaluates and selects:
    *   **Free Cancel (`CANCELLED`)**: Handled when the restaurant is at fault (e.g., out of stock, wrong dish, quality issue). The item is billed at 0 VND, and wastage is logged.
    *   **Charged Cancel (`CHARGED_CANCEL`)**: Handled when the guest changes their mind but preparation has already started. The item is stopped, but still billed at 100% price on the invoice to cover material costs.
*   **Rationale**: Prevents revenue loss from guest-side mind changes while allowing operational flexibility for restaurant mistakes.

### 4. Bank Transfer Payment Verification (Q4)
*   **Decision**: **Cashier-Confirmed (Manual)**.
*   **Behavior**: The guest UI displays a static VietQR containing the exact amount and account details. Once the transfer is completed, the Cashier verifies the transaction on the restaurant's banking app and clicks "Confirm Payment" on the POS screen to close the session.
*   **Rationale**: Keeps MVP development simple and secure without integrating complex real-time banking webhooks.

### 5. Table Status Synchronization (Q5)
*   **Decision**: **Derived dynamically from Active Session**.
*   **Behavior**: Table status (`AVAILABLE`, `OCCUPIED`, `AWAITING_PAYMENT`) is not stored separately but computed on-the-fly based on the active table session:
    *   No live session / Session is `CLOSED` $\rightarrow$ **AVAILABLE**.
    *   Session is `ACTIVE` $\rightarrow$ **OCCUPIED**.
    *   Session is `AWAITING_PAYMENT` $\rightarrow$ **AWAITING_PAYMENT**.
*   **Rationale**: Avoids data synchronization bugs and duplicate state in the database.

### 6. Reporting Scope (Q6)
*   **Decision**: **Revenue is paid-only; Sales volume includes served items**.
*   **Behavior**:
    *   Financial and revenue reports strictly aggregate **Paid Invoices**.
    *   Best-selling dishes and operational volume reports analyze all **`SERVED`** items to accurately capture demand, even if the final table bill is not yet marked paid.
*   **Rationale**: Prevents inflated revenue reporting while maintaining accurate sales volume analytics.

### 7. Guest Edit Audit Rules (Q7)
*   **Decision**: **Audit from `ACKNOWLEDGED` onwards only**.
*   **Behavior**: Edits and cancellations made by guests while an item is still `PENDING` are not logged in the system audit logs. System auditing is triggered only when an item status changes post-acceptance (`ACKNOWLEDGED` to `SERVED`), or when staff manually overrides a dish.
*   **Rationale**: Prevents bloated audit tables from routine, non-critical guest cart edits.

### 8. Kitchen Queue Grouping (Q8)
*   **Decision**: **Individual Item Queue sorted by Station**.
*   **Behavior**: The primary kitchen dashboard lists items individually (e.g., Table 4 - 1x Spicy Noodle L3) filtered by the station (`HOTPOT`, `GRILL`, `NOODLE`, `DRINK`, `DESSERT`, `GENERAL`). It does not group items under a single combined order card.
*   **Rationale**: Essential for hotpot/grill operational flow where different kitchen teams prepare different portions of a single table's order concurrently.

### 9. Management Role Simplification (Q9)
*   **Decision**: **Single `MANAGER` Role**.
*   **Behavior**: The system implements one all-access administrative role named `MANAGER` (or `ADMIN`), responsible for menu catalogs, floor setups, staff management, and viewing reports.
*   **Rationale**: Trivializes RBAC complexities for the MVP.

### 10. Demo Seed Data Catalog (Q10)
*   **Decision**: **Vietnamese Hotpot & Grill Catalog**.
*   **Behavior**: The database seeder will initialize a complete Vietnamese hotpot/grill/spicy noodle menu, containing:
    *   **Hotpot Broths**: Thái, Tứ Xuyên.
    *   **Grill/Hotpot Meats**: Ba chỉ bò, nấm, hải sản.
    *   **Spicy Noodles**: Seafood noodles with configuration options (Levels 0–7).
    *   **Drinks & Desserts**: Soft drinks, local teas.
    *   **Floor Layout**: Tables organized under Floor 1 and Floor 2.
*   **Rationale**: Provides an instantly impressive, high-fidelity demo catalog.

### 11. Table Merging & Combined Billing (Q11)
*   **Decision**: **POS Combined Billing at Checkout**.
*   **Behavior**: Multiple adjacent tables (e.g., Table 5 and Table 6) can have their dining sessions merged by the Cashier at checkout into a single combined invoice. Once paid, both sessions are marked `CLOSED` and both tables are freed.
*   **Rationale**: Cleanest database mapping (1 Invoice can span multiple `dining_session_id` entities) while avoiding the operational friction of real-time multi-table cart synchronization.

### 12. Kitchen Ticket Assignment & Claiming (Q12)
*   **Decision**: **Pull/Shared Queue (No Upfront Chef Assignment)**.
*   **Behavior**: Tickets on the kitchen queue are not assigned to a specific chef. Any chef at that station prepares the next item. When completed, they click "Ready", and their `user_id` is recorded in the status history for audit/performance tracking.
*   **Rationale**: Reduces staff UI friction in a busy kitchen environment, matches actual fast-paced à la carte kitchen flow, and keeps the MVP simple.

### 13. Table Reassignment & Session Transfer (Q13)
*   **Decision**: **Authorized Transfer via Staff POS**.
*   **Behavior**: Only authorized staff (Server/Manager) can transfer an active `DiningSession` to a new table. The destination table must be `AVAILABLE`. The system changes the `table_id` of the dining session, updates active kitchen tickets with the new table number via real-time WebSocket, and revokes the old table's QR token while issuing a new session token.
*   **Rationale**: Resolves table relocation scenarios seamlessly without forcing guests to cancel and re-submit orders.

### 14. Staff Call Deduplication & Anti-Spam (Q14)
*   **Decision**: **Unique Unacknowledged Call Per Table**.
*   **Behavior**: A table can have at most one active, unacknowledged staff call notification of a given type. Subsequent clicks of the same button by the guest update only the timestamp of the request and do not flood the Server dashboard with duplicate notifications.
*   **Rationale**: Prevents notification flood on staff tablets in busy environments.

### 15. Real-Time Out-of-Stock Handling (Q15)
*   **Decision**: **Instant Block & Manual Kitchen Action**.
*   **Behavior**: Toggling a menu item to `OUT_OF_STOCK` immediately disables it across all guest menus via WebSocket. Existing `PENDING` orders of this item in the kitchen queue are not automatically deleted; the kitchen staff manually rejects or waives them based on remaining stock.
*   **Rationale**: Prevents new orders immediately while leaving existing in-flight queue items to be manually reconciled by kitchen staff.

### 16. Menu Variant & Option Selection Constraints (Q16)
*   **Decision**: **Variant-Dependent Validation Limits**.
*   **Behavior**: Option groups define strict `min_selections` and `max_selections` limits. Backend and frontend validation verify option counts against these limits at order submission (e.g., choosing exactly 2 broths for a "Dual Broth Hotpot" variant).
*   **Rationale**: Ensures ordering correctness and prevents kitchen confusion due to invalid customization requests.

### 17. Invoice Adjustments & Manager Authorization (Q17)
*   **Decision**: **Mandatory Reason & Manager Approval**.
*   **Behavior**: POS supports percentage or flat discounts, and manual invoice line item adjustments. Any manual adjustment requires selecting/entering an `adjustment_reason` and is locked behind `MANAGER` authorization, logging the `adjusted_by` user ID.
*   **Rationale**: Permits necessary business flexibility for goodwill or operational errors while strictly auditing staff financial actions.

### 18. Secure Static QR & Dynamic Session Token Model (Q18)
*   **Decision**: **Hybrid Security Token Model**.
*   **Behavior**:
    *   The physical QR code stuck on each table is **100% static** and encodes only the `table_id`.
    *   A dining session must be **initiated by staff** on the POS system (clicking "Open Table" when seating guests), which generates a unique, temporary `session_token` for that table's active session.
    *   Scanning the static QR joins the active session and assigns the dynamic `session_token` to the guest's browser (`localStorage`).
    *   Upon checkout and session closure, the `session_token` is **permanently revoked**. Subsequent scans or URL requests using the old token are blocked. If the table is empty (no active session), scanning the static QR displays a *"Table not yet opened"* greeting screen.
*   **Rationale**: Guarantees absolute ordering security (prevents customers from ordering from home or trolling other tables) with zero operational friction (no daily physical QR printing required).

### 19. Cashier Real-Time Payment Alert & Audio Chimes (Q19)
*   **Decision**: **WebSocket Popups, Audio Pings, and State Transitions**.
*   **Behavior**:
    *   When a guest clicks "Request Payment", the WebSocket instantly broadcasts a visual toast alert to the Cashier POS dashboard, and the table card flashes.
    *   The POS browser plays a subtle **audio chime (chime ping)** to alert the staff auditorily.
    *   When the Cashier clicks "Prepare Invoice" (Lập hóa đơn), the table alert changes state from "Awaiting Payment" to "Processing Payment" across all staff dashboards to prevent duplicate employee runs.
*   **Rationale**: Keeps staff highly responsive in noisy dining room environments while avoiding double-handling of table requests.

***

*Back to [Overview & Epics](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories-and-product-backlog.md)*
