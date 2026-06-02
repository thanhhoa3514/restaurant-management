# Restaurant QR Ordering System — Backend

A backend for a **dine-in restaurant** where guests order from their table by scanning a **QR code**. Built for a **Vietnamese hotpot & grill (lẩu & nướng)** venue using an **à la carte** model: guests order item-by-item, add more rounds throughout the meal, and pay the combined total at the end. Not a buffet, not pay-per-head, not fast-food takeaway.

> This is a graduation-thesis project. **Current phase: architecture scaffolding only** — structure, interfaces, and stubs that compile. Business logic is implemented later. See `../docs/AGENT_PROMPT.md` for the exact scaffolding task and `../docs/ARCHITECTURE.md` for the full design.

## What the system does

Guests scan a QR at the table → join the table's dining session → browse the menu → place orders and add more items over the meal → track each dish's status in real time → call staff / request the bill. Kitchen receives tickets in real time and advances each dish's status. Servers watch table signals and mark dishes served. Cashiers build the snapshot invoice, apply discounts, take payment (cash / card / e-wallet), print, and close the session. Managers manage menu, availability, QR codes, tables, users, and reports.

## Roles (6)

`Guest` (Khách) · `Server` (Phục vụ) · `Kitchen` (Bếp) · `Cashier` (Thu ngân) · `Manager/Admin` (Quản lý) · `Payment Gateway` (secondary actor).
Guests are **not** authenticated — scanning a QR issues a short-lived session token. Staff authenticate with JWT + role-based access.

## Domain in one minute

- A **table** belongs to an **area**; each table has a **QR code**.
- Scanning opens or joins a **dining session** (`ACTIVE → AWAITING_PAYMENT → CLOSED`). **At most one ACTIVE session per table.**
- A session holds one or more **orders** (each "add more" round is a new order); an order holds **order items**.
- Each **order item** moves through `PENDING → ACKNOWLEDGED → PREPARING → READY → SERVED`. **Status lives on the item, not on the order** ("whole order" buttons are just bulk shortcuts).
- At end of meal, the **invoice** is built from the session's items as a **snapshot** (name/price copied at billing time), discounts applied, payment taken, session closed, table freed.

## Business rules an agent MUST NOT break

1. **One ACTIVE session per table** (enforced by a partial unique index).
2. **Snapshot**: item name & price are copied onto `order_item` at order time and onto `invoice_item` at billing time. Later menu price/name changes must NOT alter past orders or invoices.
3. **Cancel/edit**: a guest may cancel/edit a dish directly only while it is `PENDING`. Once the kitchen has accepted it (`ACKNOWLEDGED`+), changes require a **cancel request** that the kitchen approves/rejects.
4. **Status order**: transitions must follow the lifecycle; status is per-item.
5. **Payment lock**: requesting payment moves the session to `AWAITING_PAYMENT` and **blocks further ordering**.
6. **E-wallet = 2 phases**: initiate → gateway → webhook callback. The webhook handler must be **idempotent** (never double-charge / double-confirm).
7. **Multi-tenant**: every row carries `restaurant_id`; **every query is scoped by it**. No cross-restaurant leakage.
8. **Money is VND as an integer** (`int64`), never a float. **Soft delete** (`deleted_at`); **optimistic locking** via `version`.
9. **Guest UI shows dishes & status only — never prices or running total.**

## Architecture (summary)

**Modular monolith, Hexagonal/Clean Architecture + DDD.** Single Go service split by **bounded context**; the domain is the core and depends on nothing outward.

Dependency rule: `interfaces → application → domain ← infrastructure`. The `domain` package must not import Gin / pgx / websocket / jwt.

Bounded contexts: `identity` · `catalog` · `dining` · `ordering` (incl. kitchen-facing handlers) · `billing`. Cross-cutting (`platform/`): config, Tx manager, transactional outbox dispatcher, WebSocket hub, auth/RBAC, tenant context, envelope responses, logger.

**Real-time**: domain change + an `event_outbox` row are written in the **same transaction**; a dispatcher polls with `FOR UPDATE SKIP LOCKED` (plus `LISTEN/NOTIFY` for low latency), runs idempotent handlers with retry + dead-letter, and pushes events to the WebSocket hub → kitchen / server / guest screens.

Full detail (folder tree, aggregates, layer roles, snippets) is in **`../docs/ARCHITECTURE.md`**.

## Tech stack

Go 1.22+ · Gin · PostgreSQL 15+ · pgx/v5 · Goose (migrations) · gorilla/websocket · google/uuid · golang-jwt/v5 · validator/v10 · slog · OpenAPI 3.0. Deploy: Docker / docker-compose (later: AWS, Terraform, Ansible, S3).

## API conventions

- Envelope: `{ "data": ..., "meta": ..., "error": null }`; on error `{ "data": null, "error": { "code", "message" } }`.
- JSON keys **snake_case**; timestamps **ISO 8601** (stored `TIMESTAMPTZ`); IDs **UUID**; money **VND int64**.

## Project layout (top level)

```
cmd/api/           entrypoint + wiring (DI)
internal/platform/ cross-cutting infra (config, postgres, outbox, realtime, httpx, auth, tenant, logger)
internal/modules/  bounded contexts, each with domain/ application/ infrastructure/ interfaces/
internal/shared/   shared kernel (money, id, apperr)
migrations/        goose *.sql
api/openapi.yaml   API spec
deployments/       Dockerfile, docker-compose.yml
```

## Getting started (dev)

```bash
make build            # go build ./...
docker compose -f deployments/docker-compose.yml up -d  # app + postgres
make migrate          # apply goose migrations
make run              # start API + websocket + outbox dispatcher
```

(During the scaffolding phase, handlers are stubs; the server still starts.)

## Companion docs

- `../docs/ARCHITECTURE.md` — full DDD design, folder tree, patterns, code snippets.
- `../docs/AGENT_PROMPT.md` — the scaffolding task for a coding agent (phases + Definition of Done).
- `api/openapi.yaml` — API contract.

## Glossary (VI ↔ EN)

| Tiếng Việt | English | Note |
|---|---|---|
| Phiên (DiningSession) | session | one table's meal; one ACTIVE per table |
| Bàn / Khu vực | table / area | |
| Thực đơn / Món / Danh mục | menu / item / category | |
| Còn / Hết | available / out of stock | propagated real-time |
| Đơn / Món gọi | order / order item | "add more" = new order |
| Gọi thêm | add more items | core à la carte flow |
| Trạng thái món | item status | PENDING…SERVED, per item |
| Yêu cầu hủy | cancel request | needed after kitchen accepts |
| Hóa đơn (snapshot) | invoice | name/price copied at billing |
| Giảm giá / Điều chỉnh | discount / adjustment | logged |
| Thanh toán (tiền mặt/thẻ/ví) | payment (cash/card/e-wallet) | e-wallet = 2-phase + webhook |
| Đóng phiên | close session | frees the table |
| Quét QR | scan QR | issues guest session token |
