# User Stories and Product Backlog — Restaurant QR Ordering System

Source PRD: The main Product Requirement Document is in [PRD Document](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/PRD%20-%20H%E1%BB%87%20th%E1%BB%91ng%20qu%E1%BA%A3n%20l%C3%BD%20nh%C3%A0%20h%C3%A0ng%20l%E1%BA%A9u%20n%C6%B0%E1%BB%9Bng,%20m%E1%BB%B3%20cay%20%2037077023e0b481aa8c20e02e28e9a846.md).

***

## 📁 Document Directory

To make these specifications easier to read and maintain, the comprehensive backlog has been split into dedicated modules:

1.  **[User Stories Catalog](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md)**: Details the complete list of 71 functional user stories across all 12 epics.
2.  **[Prioritized Product Backlog & NFRs](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/product-backlog.md)**: Outlines the release planning (Releases 1–6), non-functional requirements (NFRs), and the MVP Definition of Done (DoD).
3.  **[Resolved Product Decisions](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/open-product-questions.md)**: Details the agreed-upon design alignments, checkout rules, waste audits, and database state mappings resolved during the product interview.

***

## Product Goal

Deliver an MVP for a dine-in hotpot, grill, and spicy noodle restaurant where guests scan a table QR code, order from their phone, kitchen staff receive real-time tickets, servers track table signals and ready dishes, cashiers prepare session invoices, and managers configure operations.

Core flow:

```text
Table QR -> dining session -> menu -> order -> kitchen ticket -> item status -> serve -> payment request -> invoice -> payment -> session close
```

## MVP Rules

*   Guests do not log in; they use a secure QR/session token.
*   Staff users log in and are authorized by role.
*   One table can have only one live dining session.
*   Item status belongs to each order item, not to the whole order.
*   Item and invoice snapshots preserve historical names and VND prices.
*   Realtime updates are required for orders, item status, staff calls, and payment requests.
*   MVP payment supports cashier-confirmed cash and bank transfer only.

## Actors

| Actor | Main Goal |
|---|---|
| **Guest** | Order food, track dishes, call staff, request payment from the table |
| **Server** | Monitor tables, respond to guest signals, serve ready dishes |
| **Kitchen Staff** | Receive tickets, prepare dishes, update item status, review cancel requests |
| **Cashier** | Prepare invoice, record payment, close dining session |
| **Manager** | Manage menu, tables, QR codes, staff, and reports |
| **System** | Enforce invariants, preserve snapshots, broadcast events, audit sensitive actions |

## Epics

| Epic | Scope | Priority |
|---|---|---|
| **EPIC-01** | Identity and Access Control | Must Have |
| **EPIC-02** | Tables, QR Codes, and Dining Sessions | Must Have |
| **EPIC-03** | Menu Catalog and Availability | Must Have |
| **EPIC-04** | Guest Ordering | Must Have |
| **EPIC-05** | Item Lifecycle and Cancellation | Must Have |
| **EPIC-06** | Kitchen Workflow | Must Have |
| **EPIC-07** | Server Floor Operations | Must Have |
| **EPIC-08** | Billing and Session Closure | Must Have |
| **EPIC-09** | Realtime Signals | Must Have |
| **EPIC-10** | Management and Reporting | Should Have |
| **EPIC-11** | Audit, Security, and Data Integrity | Must Have |
| **EPIC-12** | Future Enhancements | Future |
