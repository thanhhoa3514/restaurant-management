# Prioritized Product Backlog & Non-Functional Requirements

This document details the release planning, prioritized product backlog, non-functional requirements, and Definition of Done (DoD) for the Restaurant QR Ordering System.

## Prioritized Product Backlog

### Release 1 — Foundation and Data Integrity

| Rank | Story | Why first |
|---:|---|---|
| 1 | [US-062](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L73) | Tenant safety is cross-cutting. |
| 2 | [US-001](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L9) | Staff workflows need authentication. |
| 3 | [US-002](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L10) | Protected roles are required. |
| 4 | [US-010](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L18) | Tables are required before sessions. |
| 5 | [US-011](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L19) | QR access depends on table QR. |
| 6 | [US-006](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L14) | Core dining session creation. |
| 7 | [US-007](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L15) | Multiple guests must share one table session. |
| 8 | [US-030](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L38) | Order snapshot invariant. |
| 9 | [US-031](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L39) | Item status invariant. |
| 10 | [US-065](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L76) | Historical data correctness. |

### Release 2 — Catalog and Guest Ordering

| Rank | Story | Why now |
|---:|---|---|
| 11 | [US-015](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L23) | Category setup. |
| 12 | [US-016](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L24) | Menu item setup. |
| 13 | [US-017](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L25) | Variant support for hotpot/grill/noodle portions. |
| 14 | [US-018](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L26) | Option support for spice, broth, sauce, add-ons. |
| 15 | [US-019](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L27) | Availability prevents impossible orders. |
| 16 | [US-005](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L13) | Guest session entry. |
| 17 | [US-012](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L20) | Guest menu navigation. |
| 18 | [US-013](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L21) | Guest menu list. |
| 19 | [US-014](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L22) | Guest item configuration. |
| 20 | [US-022](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L30) | Cart correctness. |
| 21 | [US-020](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L28) | First order flow. |
| 22 | [US-021](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L29) | Additional order flow. |

### Release 3 — Kitchen and Item Lifecycle

| Rank | Story | Why now |
|---:|---|---|
| 23 | [US-034](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L42) | Kitchen needs incoming work queue. |
| 24 | [US-035](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L43) | Station filtering matches restaurant operations. |
| 25 | [US-036](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L44) | Kitchen acceptance starts controlled lifecycle. |
| 26 | [US-037](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L45) | Active preparation state. |
| 27 | [US-038](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L46) | Ready state creates server handoff. |
| 28 | [US-032](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L40) | Status history supports audit and reports. |
| 29 | [US-027](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L35) | Guest transparency. |
| 30 | [US-024](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L32) | Direct pending cancellation. |
| 31 | [US-026](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L34) | Post-acceptance cancel request. |
| 32 | [US-039](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L47) | Kitchen cancel decision. |

### Release 4 — Server Floor and Realtime Signals

| Rank | Story | Why now |
|---:|---|---|
| 33 | [US-041](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L49) | Server operational dashboard. |
| 34 | [US-042](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L50) | Table/session detail for assistance. |
| 35 | [US-028](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L36) | Guest staff-call signal. |
| 36 | [US-043](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L51) | Staff-call acknowledgement. |
| 37 | [US-044](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L52) | Complete item lifecycle with SERVED. |
| 38 | [US-008](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L16) | Staff-assisted walk-in sessions. |
| 39 | [US-054](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L62) | New order realtime path. |
| 40 | [US-055](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L63) | Status realtime path. |
| 41 | [US-056](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L64) | Table signal realtime path. |

### Release 5 — Billing and Session Closure

| Rank | Story | Why now |
|---:|---|---|
| 42 | [US-029](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L37) | Guest payment request. |
| 43 | [US-033](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L41) | Lock session before invoice finalization. |
| 44 | [US-045](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L53) | Server-assisted payment request. |
| 45 | [US-046](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L54) | Cashier queue. |
| 46 | [US-047](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L55) | Invoice from session. |
| 47 | [US-048](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L56) | Invoice review. |
| 48 | [US-050](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L58) | Cash payment. |
| 49 | [US-051](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L59) | Bank transfer payment. |
| 50 | [US-053](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L61) | Close session and free table. |
| 51 | [US-049](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L57) | Basic adjustments. |
| 52 | [US-052](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L60) | Receipt output. |

### Release 6 — Management, Audit, and Reporting

| Rank | Story | Why now |
|---:|---|---|
| 53 | [US-004](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L12) | Staff administration. |
| 54 | [US-009](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L17) | Area administration. |
| 55 | [US-063](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L74) | Sensitive action traceability. |
| 56 | [US-064](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L75) | QR security. |
| 57 | [US-066](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L77) | Concurrent update safety. |
| 58 | [US-058](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L66) | Revenue reporting. |
| 59 | [US-059](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L67) | Best-selling item reporting. |
| 60 | [US-060](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L68) | Order volume reporting. |
| 61 | [US-061](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L69) | Timing report. |
| 62 | [US-003](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L11) | Logout hardening. |
| 63 | [US-023](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L31) | Guest submitted item list. |
| 64 | [US-025](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L33) | Pending edit support. |
| 65 | [US-040](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L48) | Kitchen item history. |
| 66 | [US-057](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L65) | Outbox reliability depth. |

## Future Backlog Outside MVP

| Story | Reason deferred |
|---|---|
| [US-067](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L79) | Real gateway integration increases webhook and reconciliation complexity. |
| [US-068](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L80) | Inventory adds a large ingredient/recipe domain. |
| [US-069](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L81) | Reservations are outside dine-in QR ordering core. |
| [US-070](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L82) | Loyalty requires customer identity and reward rules. |
| [US-071](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md#L83) | Multi-branch scope is beyond one-restaurant thesis MVP. |

## Non-Functional Stories

| ID | Story | Acceptance Criteria | Priority |
|---|---|---|---|
| NFR-001 | As a guest, I want a mobile-first UI, so that ordering works comfortably on my phone. | Core guest screens work on common mobile sizes. | Must |
| NFR-002 | As staff, I want realtime responsiveness, so that operations are not delayed. | Orders and status updates appear fast enough for restaurant use. | Must |
| NFR-003 | As any user, I want reconnect recovery, so that temporary network issues do not lose state. | Refresh/reconnect loads latest session, queue, and signal state. | Must |
| NFR-004 | As the system, I want secure staff authentication, so that protected actions require staff identity. | Staff endpoints require valid authentication and role checks. | Must |
| NFR-005 | As the system, I want secure QR access, so that table sessions cannot be guessed. | QR/session tokens are unique, random, scoped, and revocable. | Must |
| NFR-006 | As the system, I want strong consistency rules, so that operations remain correct. | One live session per table, valid status transitions, and snapshot immutability are enforced. | Must |
| NFR-007 | As a manager, I want auditability, so that sensitive operations can be reviewed. | Sensitive actions include actor, entity, before/after where useful, and timestamp. | Must |
| NFR-008 | As a developer, I want maintainable architecture, so that the thesis system is easy to extend. | Modules remain separated by identity, catalog, dining, ordering, billing, and platform concerns. | Must |
| NFR-009 | As staff, I want normal-load performance, so that multiple tables can order concurrently. | Common actions respond acceptably under expected restaurant traffic. | Should |
| NFR-010 | As any user, I want clear errors, so that I know what to fix next. | Validation and workflow errors are actionable and role-appropriate. | Should |

## MVP Definition of Done

- **Guest Access**: Guests can scan QR and join the correct table session.
- **Guest Core Loop**: Guests can browse menu, configure items, place orders, add more items, call staff, and request payment.
- **Session Safety**: The system prevents more than one live session for the same table.
- **Kitchen Lifecycle**: Kitchen staff receive tickets and update item status through the valid lifecycle up to `READY`.
- **Server Floor Loop**: Servers see table signals, mark `READY` items as `SERVED`, and request payment for a table.
- **Cashier Closure**: Cashiers prepare snapshot invoices, record cash or bank transfer payment, and close sessions.
- **Manager Catalog**: Managers can manage menu items, availability, tables, QR codes, and staff users at a basic level.
- **Snapshots**: Item and invoice snapshots remain stable after catalog changes.
- **Isolation**: Restaurant data is scoped by `restaurant_id`.
- **Realtime**: Core realtime updates work or recover on refresh.
- **Audit Logs**: Sensitive actions are audit logged.

***

*Back to [Overview & Epics](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories-and-product-backlog.md) | Go to [User Stories Catalog](file:///home/thanhhoa/thanhhoa/restaurant-management/docs/prd/user-stories.md)*
