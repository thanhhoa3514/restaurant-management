# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

QR-ordering system for a dine-in Vietnamese hotpot & grill (lẩu & nướng) restaurant, à la carte. Guests scan a table QR → join a dining session → browse menu → order in rounds ("add more") → pay combined total at the end. Graduation-thesis project. Monorepo: `backend/` (Go API), `frontend/` (Vite/React), `docs/` (architecture, schema, plans).

## Commands

Root `Makefile` proxies into `backend/`:

```bash
make verify            # backend build+vet+test AND frontend build — run before declaring done
make backend-test      # go test ./...
make backend-build     # go build ./...
make frontend-build    # tsc -b && vite build
make frontend-lint
```

Backend (`cd backend`, `Makefile`):

```bash
make dev               # postgres (docker) up → wait healthy → migrate → run API
make db-up             # start postgres + minio only (compose)
make migrate           # goose migrations (REQUIRED before API starts)
make seed              # seed DB — REQUIRED: API resolves the single restaurant UUID at boot from `restaurants` table, won't start on empty DB
make run               # migrate then go run ./cmd/api
make test              # go test ./...
go test ./internal/modules/ordering/... -run TestName   # single package / single test
make compose-up        # full stack in docker (postgres → migrate → app)
```

Default `DATABASE_URL`: `postgres://postgres:postgres@localhost:5440/restaurant?sslmode=disable` (host port 5440).

Frontend (`cd frontend`):

```bash
npm run dev            # vite dev server
npm run build          # tsc -b && vite build
npm run lint           # eslint
npm run format         # prettier --write
```

## Backend architecture

**Modular monolith, Hexagonal + DDD.** One Go service split by bounded context. Modules: `identity` · `catalog` · `dining` · `ordering` (incl. kitchen handlers) · `billing`.

Each module has four layers with a strict dependency rule `interfaces → application → domain ← infrastructure`:

- `domain/` — aggregates + business rules. MUST NOT import Gin / pgx / websocket / jwt.
- `application/` — one struct per use-case (e.g. `GuestPlaceOrder`, `BuildInvoice`), constructed with `(tx, repo, outboxWriter, defaultRID)`.
- `infrastructure/postgres/` (and `gateway/` in billing) — repo + adapter implementations.
- `interfaces/http/` — Gin handlers + `Register*Routes`.

Cross-cutting lives in `internal/platform/`: `config`, `postgres` (pool + `TxManager`), `outbox` (transactional dispatcher), `realtime` (WebSocket `Hub`), `auth` (JWT + RBAC + QR token), `tenant`, `httpx` (envelope + middleware), `storage` (S3/minio), `logger`. Shared kernel in `internal/shared/`: `money`, `id`, `apperr`.

**DI is manual** — everything is wired in `cmd/api/main.go` `wireRoutes()`. Add a use-case → construct it there and pass into the module handler. `cmd/` also holds `migrate` and `seed` entrypoints.

**Single-restaurant deployment**: rows still carry `restaurant_id` (multi-tenant schema), but `cfg.DefaultRestaurantID` is resolved once at boot and threaded through every use-case.

**Realtime = transactional outbox**: a domain write + an `event_outbox` row commit in the SAME transaction; the dispatcher polls (`FOR UPDATE SKIP LOCKED` + `LISTEN/NOTIFY`), runs idempotent handlers, pushes to the WebSocket hub → kitchen/server/guest screens.

**Two auth surfaces** (see route groups in `wireRoutes`):
- `/api/v1/customer/*` — guest. Some public (browse menu, join session); ordering routes require a **QR session token** via `auth.QRSessionToken` (header `X-Session-Token`).
- `/api/v1/restaurant/*` — staff, **JWT + role-based** access.
- `/api/v1/.../webhooks/*` — called by payment gateways (mock/MoMo/ZaloPay), registered via `RegisterWebhookRoutes`; handlers must be idempotent.

**API conventions**: envelope `{ "data": …, "meta": …, "error": null }` (or `error: {code,message}`); JSON keys snake_case; UUIDs; timestamps ISO 8601 / `TIMESTAMPTZ`; money is **VND `int64`, never float**; soft delete (`deleted_at`); optimistic locking (`version`).

## Business rules an agent MUST NOT break

1. **One ACTIVE session per table** (partial unique index).
2. **Snapshot**: item name & price copied onto `order_item` at order time and `invoice_item` at billing time. Later menu changes must NOT alter past orders/invoices.
3. **Status is per order-item**, not per order: `PENDING → ACKNOWLEDGED → PREPARING → READY → SERVED`. "Whole order" buttons are bulk shortcuts.
4. **Cancel/edit**: guest may edit/cancel a dish directly only while `PENDING`. After kitchen accepts (`ACKNOWLEDGED`+) it needs a **cancel request** the kitchen approves/rejects.
5. **Payment lock**: requesting payment → session `AWAITING_PAYMENT`, blocks further ordering.
6. **E-wallet = 2 phases** (initiate → gateway → webhook); webhook must be idempotent (never double-charge).
7. **Guest UI shows dishes & status only — never prices or running total.**

Session lifecycle: `ACTIVE → AWAITING_PAYMENT → CLOSED`. Roles: Guest · Server · Kitchen · Cashier · Manager/Admin.

## Frontend architecture

Vite + React + TypeScript. **TanStack Router** (file-based routes in `src/routes/`, `routeTree.gen.ts` is generated) + **TanStack Query**. Feature-sliced: `src/features/{ordering,kitchen,waiter,cashier,billing,catalog,dining,admin,login,landing}/` each with its own `api.ts`, `components/`, `hooks/`, `types.ts`. Cross-cutting in `src/lib/` (`api.ts`, `auth.ts`, `permissions.tsx`, `realtime.tsx`, `brand.ts`, `use-lang.ts`). Shared components in `src/components/` incl. shadcn-style `ui/` (Radix + base-ui + Tailwind, `class-variance-authority`). Forms: react-hook-form + zod. PDF invoices: `@react-pdf/renderer`.

**All HTTP goes through `apiRequest` in `src/lib/api.ts`** — it unwraps the envelope, throws `ApiError(status, code, message)`, attaches staff JWT (`Authorization: Bearer`) or guest token (`X-Session-Token` when `sessionToken` passed), and transparently retries once on 401 via `refreshStaffSession()`. Don't call `fetch` directly in features.

**Admin is a single permission-tree shell** (`src/components/admin-shell.tsx`, `admin-sidebar.tsx`, `permissions.tsx`) rather than one screen per role — nav splits into operate vs manage sections gated by role. UI copy is Vietnamese-first (see `use-lang.ts`, feature `i18n.ts`, `shell-i18n.ts`).

## Docs & conventions

- `docs/ARCHITECTURE.md`, `docs/SYSTEM_ARCHITECTURE.md`, `docs/DDD_HEXAGONAL.md` — full backend design.
- `docs/database_schema_lau_nuong_my_cay.md` — schema; `docs/FEATURE_FLOW.md`, `docs/USE_CASES_AND_DIAGRAMS.md` — flows.
- `docs/plans/` — implementation specs (backend is coded from these, then reviewed).
- `backend/api/openapi.yaml` — API contract; served via swagger UI (`swaggerui.Register`).

## CodeGraph

This project has a CodeGraph MCP server (`codegraph_*` tools) — a tree-sitter knowledge graph of every symbol/edge/file. Prefer it for **structural** questions (where is X defined, what calls Y, what breaks if I change Z, show a symbol's source). Use `codegraph_context` first for task/area onboarding, then one `codegraph_explore` for the surfaced symbols' source. Trust its results — don't re-verify with grep. Use native grep/read only for literal text (strings, comments) or after a file is open.
