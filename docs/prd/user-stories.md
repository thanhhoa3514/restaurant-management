# User Stories Catalog — Restaurant QR Ordering System

This catalog details all functional user stories defined for the Restaurant QR Ordering System, categorized by Epics.

## Epic Reference

*   **EPIC-01**: Identity and Access Control
*   **EPIC-02**: Tables, QR Codes, and Dining Sessions
*   **EPIC-03**: Menu Catalog and Availability
*   **EPIC-04**: Guest Ordering
*   **EPIC-05**: Item Lifecycle and Cancellation
*   **EPIC-06**: Kitchen Workflow
*   **EPIC-07**: Server Floor Operations
*   **EPIC-08**: Billing and Session Closure
*   **EPIC-09**: Realtime Signals
*   **EPIC-10**: Management and Reporting
*   **EPIC-11**: Audit, Security, and Data Integrity
*   **EPIC-12**: Future Enhancements (Post-MVP)

## User Stories Table

| ID | Epic | Priority | User Story | Acceptance Criteria |
|---|---|---|---|---|
| US-001 | EPIC-01 | Must | As a staff member, I want to log in, so that I can access the tools for my role. | Valid credentials create a staff session; invalid credentials return a safe error; session includes user, role, and restaurant. |
| US-002 | EPIC-01 | Must | As a manager, I want role-based access, so that staff can only use authorized workflows. | Server, kitchen, cashier, and manager routes are protected; unauthorized access is rejected. |
| US-003 | EPIC-01 | Should | As a staff member, I want to log out, so that my shared-device session cannot be reused. | Logout invalidates the session; protected actions require a new login. |
| US-004 | EPIC-01 | Should | As a manager, I want to manage staff users, so that each employee has the correct role. | Manager can create, update, deactivate, lock, and assign roles; sensitive changes are audited. |
| US-005 | EPIC-02 | Must | As a guest, I want to scan a table QR code, so that I can join the correct dining session. | Valid active QR opens or joins the table session; invalid QR is rejected; guest receives a session token. |
| US-006 | EPIC-02 | Must | As the system, I want to create a dining session from QR when no live session exists, so that the meal can be tracked. | Session starts as ACTIVE; session links restaurant, table, and QR; duplicate live sessions are blocked. |
| US-007 | EPIC-02 | Must | As a guest, I want repeated QR scans to rejoin the current table session, so that multiple guests can order together. | Existing live session is reused; no duplicate session is created; users see the same session context. |
| US-008 | EPIC-02 | Must | As a server, I want to open a walk-in session, so that guests can be served without scanning QR. | Server selects an available table; session starts as ACTIVE; duplicate live session is blocked. |
| US-009 | EPIC-02 | Should | As a manager, I want to manage areas, so that tables can be organized by room, floor, or zone. | Manager can create, update, deactivate, and list areas; area names are unique per restaurant. |
| US-010 | EPIC-02 | Must | As a manager, I want to manage tables, so that the floor layout is accurate. | Manager can create, update, deactivate, and list tables; table code is unique per restaurant. |
| US-011 | EPIC-02 | Must | As a manager, I want to rotate QR codes, so that table access remains secure. | Only one active QR exists per table; rotating disables the previous QR; disabled QR cannot start sessions. |
| US-012 | EPIC-03 | Must | As a guest, I want to browse menu categories, so that I can find dishes quickly. | Active categories are visible, ordered, and mobile-friendly. |
| US-013 | EPIC-03 | Must | As a guest, I want to browse menu items, so that I can decide what to order. | Items show name, image, description, availability, variants, and options where applicable. |
| US-014 | EPIC-03 | Must | As a guest, I want to view item details, so that I can choose variants and options correctly. | Detail page shows variants, required options, selection limits, and availability. |
| US-015 | EPIC-03 | Should | As a manager, I want to manage categories, so that the menu is organized. | Manager can create, update, reorder, deactivate, and list categories. |
| US-016 | EPIC-03 | Must | As a manager, I want to manage menu items, so that menu content stays accurate. | Manager can create, update, archive, and list items; changes do not alter historical snapshots. |
| US-017 | EPIC-03 | Should | As a manager, I want to manage item variants, so that items can support sizes or portions. | Variants can be added, reordered, disabled, and marked default; prices are VND integers. |
| US-018 | EPIC-03 | Should | As a manager, I want to manage option groups and options, so that guests can customize dishes. | Single/multiple selection rules work; required groups block invalid orders; price deltas use VND integers. |
| US-019 | EPIC-03 | Must | As a manager, I want to toggle item availability, so that guests cannot order unavailable dishes. | Availability changes are saved; guest ordering blocks unavailable items; realtime update is sent when connected. |
| US-020 | EPIC-04 | Must | As a guest, I want to place my first order, so that the kitchen can start preparing food. | Cart validates; order links to active session; item details are snapshotted; kitchen tickets are created. |
| US-021 | EPIC-04 | Must | As a guest, I want to add more items during the same meal, so that I can order additional rounds. | Additional order belongs to same session; new tickets are created; ordering is blocked in AWAITING_PAYMENT or CLOSED. |
| US-022 | EPIC-04 | Must | As a guest, I want my cart validated before submission, so that I do not send incomplete or unavailable items. | Missing options, invalid quantity, and unavailable items are blocked with actionable errors. |
| US-023 | EPIC-04 | Must | As a guest, I want to view submitted items, so that I know what has been sent to the kitchen. | Guest sees session items, quantity, options, and status; running total can be hidden by product rule. |
| US-024 | EPIC-04 | Must | As a guest, I want to cancel a pending item, so that I can correct mistakes before kitchen acceptance. | Only PENDING items can be directly cancelled; cancellation is recorded and broadcast. |
| US-025 | EPIC-04 | Should | As a guest, I want to edit a pending item, so that I can change options or quantity before preparation. | Only PENDING items can be edited; edits revalidate item, options, quantity, and availability. |
| US-026 | EPIC-04 | Must | As a guest, I want to request cancellation after kitchen acceptance, so that the kitchen can approve or reject it. | ACKNOWLEDGED/PREPARING items require a cancel request; guest can track pending/approved/rejected status. |
| US-027 | EPIC-04 | Must | As a guest, I want to track dish status in real time, so that I know what is pending, preparing, ready, or served. | Item status updates without refresh when connected; refresh loads latest state. |
| US-028 | EPIC-04 | Must | As a guest, I want to call staff, so that I can ask for help from my table. | Staff-call signal links table/session and appears on server screen in real time. |
| US-029 | EPIC-04 | Must | As a guest, I want to request payment, so that staff can prepare the bill. | Session moves to AWAITING_PAYMENT; further ordering is blocked; server and cashier are notified. |
| US-030 | EPIC-05 | Must | As the system, I want order item snapshots, so that menu changes do not alter historical orders. | Item name, code, variant, options, and VND prices are stored at order time. |
| US-031 | EPIC-05 | Must | As the system, I want valid item status transitions, so that staff cannot move dishes into invalid states. | Valid flow is PENDING -> ACKNOWLEDGED -> PREPARING -> READY -> SERVED; invalid transitions fail. |
| US-032 | EPIC-05 | Must | As a manager, I want item status history, so that preparation and service activity can be audited. | Each transition stores from/to status, actor, role, timestamp, and optional note. |
| US-033 | EPIC-05 | Must | As the system, I want to block new orders during payment, so that invoices remain stable. | ACTIVE sessions accept orders; AWAITING_PAYMENT and CLOSED sessions reject new orders. |
| US-034 | EPIC-06 | Must | As kitchen staff, I want a real-time kitchen queue, so that I can see new work immediately. | New tickets appear without refresh; tickets show table, item, quantity, options, notes, station, and time. |
| US-035 | EPIC-06 | Must | As kitchen staff, I want station filters, so that each station sees relevant dishes. | Filters include hotpot, grill, noodle, drink, dessert, and general. |
| US-036 | EPIC-06 | Must | As kitchen staff, I want to acknowledge an item, so that guests know the kitchen accepted it. | Kitchen can move PENDING -> ACKNOWLEDGED; direct guest edit/cancel is disabled. |
| US-037 | EPIC-06 | Must | As kitchen staff, I want to start preparation, so that active work is visible. | Kitchen can move ACKNOWLEDGED -> PREPARING; event is recorded and broadcast. |
| US-038 | EPIC-06 | Must | As kitchen staff, I want to mark an item ready, so that servers can deliver it. | Kitchen can move PREPARING -> READY; server and guest views update. |
| US-039 | EPIC-06 | Must | As kitchen staff, I want to review cancel requests, so that accepted items are not cancelled without kitchen approval. | Kitchen can approve/reject with note; guest and server receive the decision. |
| US-040 | EPIC-06 | Could | As kitchen staff, I want to view item status history, so that I can understand what happened to a dish. | History is chronological and limited to relevant operational data. |
| US-041 | EPIC-07 | Must | As a server, I want to view tables by area, so that I can monitor the dining room efficiently. | Table grid shows available, occupied, awaiting payment, and needs-attention states. |
| US-042 | EPIC-07 | Must | As a server, I want to view table session detail, so that I can help guests and coordinate service. | Detail shows active session, orders, item statuses, staff calls, and payment requests. |
| US-043 | EPIC-07 | Must | As a server, I want to acknowledge staff calls, so that other staff know the request is handled. | Signal state updates for all server views and stores actor/timestamp. |
| US-044 | EPIC-07 | Must | As a server, I want to mark ready dishes as served, so that item status reflects table service. | Server can move READY -> SERVED; guest, kitchen, and cashier views update. |
| US-045 | EPIC-07 | Must | As a server, I want to request payment for a table, so that guests can pay without using their phone. | Server can move active session to AWAITING_PAYMENT; cashier is notified; new ordering is blocked. |
| US-046 | EPIC-08 | Must | As a cashier, I want to see sessions awaiting payment, so that I know which tables need invoices. | List shows table, session code, open time, and status; updates in real time or on refresh. |
| US-047 | EPIC-08 | Must | As a cashier, I want to prepare an invoice from a session, so that all billable items are charged together. | Invoice uses snapshot line items, VND totals, restaurant scope, and session link. |
| US-048 | EPIC-08 | Must | As a cashier, I want to review invoice detail, so that I can confirm charges before payment. | Detail shows invoice number, table/session, items, discounts, service/VAT if configured, and total. |
| US-049 | EPIC-08 | Should | As a cashier, I want to apply a discount or adjustment, so that approved billing changes are handled. | Adjustment requires reason, updates totals, and creates audit log. |
| US-050 | EPIC-08 | Must | As a cashier, I want to record cash payment, so that the invoice can be marked paid. | Received amount and change are calculated; invoice payment status updates. |
| US-051 | EPIC-08 | Must | As a cashier, I want to record bank transfer payment, so that non-cash MVP payments are tracked. | Optional reference code is stored; cashier confirmation marks payment completed. |
| US-052 | EPIC-08 | Should | As a cashier, I want to print or export an invoice, so that guests receive proof of payment. | Printable invoice uses snapshot data and includes items, totals, method, and timestamp. |
| US-053 | EPIC-08 | Must | As a cashier, I want to close a paid session, so that the table becomes available. | Only paid sessions close; session becomes CLOSED; guest token can no longer order. |
| US-054 | EPIC-09 | Must | As the system, I want to broadcast new orders to kitchen, so that preparation starts quickly. | Submitted order creates kitchen events; connected kitchen clients receive them; reload recovers state. |
| US-055 | EPIC-09 | Must | As the system, I want to broadcast item status changes, so that all screens stay aligned. | Authorized subscribers receive same-restaurant updates; reconnect reloads latest state. |
| US-056 | EPIC-09 | Must | As the system, I want to broadcast table signals, so that staff can respond quickly. | Staff calls and payment requests appear in server/cashier views; acknowledgement is broadcast. |
| US-057 | EPIC-09 | Should | As the system, I want operational events persisted with domain changes, so that delivery is reliable. | Event record is stored in the same transaction; retries and inspection are possible. |
| US-058 | EPIC-10 | Should | As a manager, I want revenue reports by date range, so that I can understand performance. | Report shows paid invoice count and total revenue scoped to restaurant. |
| US-059 | EPIC-10 | Should | As a manager, I want best-selling item reports, so that I can understand demand. | Report sorts by quantity or revenue and uses snapshot data. |
| US-060 | EPIC-10 | Could | As a manager, I want order volume reports, so that I can understand workload. | Report shows orders/items by date range and optionally by station. |
| US-061 | EPIC-10 | Could | As a manager, I want preparation and service time reports, so that I can find bottlenecks. | Report uses status history and handles incomplete timelines clearly. |
| US-062 | EPIC-11 | Must | As the system, I want restaurant data isolation, so that one restaurant cannot access another's data. | Tenant context is required; repository queries filter by restaurant_id. |
| US-063 | EPIC-11 | Must | As a manager, I want sensitive actions audited, so that operational changes can be reviewed. | Cancellations, voids, adjustments, role changes, QR rotations, and price changes are logged. |
| US-064 | EPIC-11 | Must | As the system, I want secure QR tokens, so that unauthorized users cannot join table sessions. | Tokens are random, unique, revocable, and rejected when disabled. |
| US-065 | EPIC-11 | Must | As the system, I want immutable historical snapshots, so that reporting and billing stay correct. | Catalog changes do not alter order snapshots; order changes do not alter invoice snapshots. |
| US-066 | EPIC-11 | Should | As the system, I want optimistic locking, so that concurrent staff actions do not overwrite each other silently. | Stale updates return conflict; UI can reload latest state. |
| US-067 | EPIC-12 | Future | As a cashier, I want external payment gateway integration, so that guests can pay through e-wallets or bank apps. | Gateway initiation and idempotent webhook handling are supported. |
| US-068 | EPIC-12 | Future | As a manager, I want inventory management, so that item availability can be automated. | Ingredients, recipes, stock changes, and low-stock alerts are supported. |
| US-069 | EPIC-12 | Future | As a guest, I want reservations, so that I can plan my visit before arriving. | Guest can choose time and party size; staff can manage reservations. |
| US-070 | EPIC-12 | Future | As a returning customer, I want loyalty rewards, so that I have an incentive to revisit. | Customer identity, points, rewards, and redemptions are supported. |
| US-071 | EPIC-12 | Future | As an owner, I want multi-branch management, so that I can operate a chain. | Branch switching, branch-specific settings, and combined reports are supported. |

***

*Back to [Overview & Epics](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories-and-product-backlog.md) | Go to [Prioritized Product Backlog](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/product-backlog.md)*
