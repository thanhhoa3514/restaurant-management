# Permission-Tree-Driven Single Shell

**Status:** Planning (no code yet)
**Author:** Claude (plan), thanhhoa3514 (vision + implementation)
**Date:** 2026-06-05

## Goal

Collapse the four per-role staff screens (`admin`, `cashier`, `waiter`,
`kitchen`) into **one manager shell**. On login, the backend resolves the
user's permissions from `role_permissions` and returns a **permission tree**
to the client. The client renders nav + feature surfaces from that tree —
no per-role route files, no hardcoded role gates in the UI.

Motivation (user's words): "when we have a lots of screen it's gonna be
heavy." One shell, permission-driven, scales better than N screens.

---

## Addendum 2026-06-08 — Operate vs Manage split

The original plan collapsed the four **operate** workspaces into one shell.
It did not distinguish them from **manage** surfaces (catalog/staff/reports/
settings), which left admin nav rendering live staff workspaces — admin
"remoting into a staff screen" instead of managing the domain. Resolved by
splitting nav into two groups (`admin-config.ts:NavGroup`):

- **operate** — live staff workspaces (cashier/waiter/kitchen), ride `?view=`
  on `/admin`. Staff land here directly; admins reach them as a secondary group.
- **manage** — configuration/oversight per domain, each its own route under
  `/admin/*` (dashboard, table-qrs, catalog, staff, reports, settings).

Phase 1 (shipped): nav regrouped; dead `navigate({to:'/admin'})` stubs replaced
with real routes. catalog/staff/reports/settings render a `ComingSoon`
placeholder (gated by permission) until built. Build order next: `staff` first
(api+mappers already exist), then catalog/reports/settings (need specs).

---

## INVARIANT — read first

> **The permission tree is presentation-only. Server-side authorization
> is unchanged and mandatory.**

The tree decides *what the UI shows*. It does **not** decide *what the API
allows*. Every backend endpoint keeps its server-side gate. If the only
remaining gate is the client tree, this becomes an **auth-bypass**: any
authenticated user can call any endpoint directly with a valid token,
regardless of what their UI rendered.

- Client tree = convenience + UX (hide what you can't use).
- Server middleware = the real boundary.
- `tsc`/`build` cannot catch a missing server gate. Reviewer must verify
  every endpoint stays gated after the middleware migration (step 2).

---

## Current state (verified in code)

### Backend — RBAC is half-built

- **Schema already has the tables** (`migrations/00001`):
  `roles`, `permissions(code, module, ...)`, `role_permissions(role_id,
  permission_id)`, `users.role_id`.
- **But `permissions` + `role_permissions` are never seeded.** Only 4 roles
  are seeded (`manager`, `cashier`, `server`, `kitchen`). The permission
  tables are **empty and unused**.
- `platform/auth/auth.go`: JWT carries a flat `Role` string claim.
  `RBAC(roles ...string)` checks the role *name* against an allow-list.
  Permission codes play no part today.
- `authenticate.go` login returns a flat role string, no permissions.

### Backend — the 9 RBAC call sites ARE today's authorization spec

These groups define current behavior. The seed matrix must reproduce them
**exactly** — that is the regression guard.

| # | Route group | Current `auth.RBAC(...)` |
|---|---|---|
| 1 | `/billing` | CASHIER, MANAGER |
| 2 | `/identity` (admin) | MANAGER |
| 3 | `/ordering` | SERVER, KITCHEN, MANAGER |
| 4 | `/staff` (ordering) | SERVER, KITCHEN, CASHIER, MANAGER |
| 5 | `/kitchen` | KITCHEN, MANAGER |
| 6 | dining (serve) | SERVER, MANAGER |
| 7 | dining (cashier) | SERVER, CASHIER, MANAGER |
| 8 | dining (manage) | MANAGER |
| 9 | `/catalog` | MANAGER |

### Frontend — 4 role routes, hardcoded gates

- `routes/`: `admin.tsx`, `admin.table-qrs.tsx`, `cashier.tsx`,
  `waiter.tsx`, `kitchen.tsx`, `order.tsx`, `login.tsx`, `index.tsx`.
- `lib/auth.ts`: `StaffRole = 'admin'|'cashier'|'waiter'|'kitchen'` ↔
  backend `MANAGER|CASHIER|SERVER|KITCHEN`. `isStaffAuthenticated(role)`
  with `admin` as superuser. Each route gated by a single hardcoded role.
- Shell groundwork already done (admin overhaul): `lib/use-lang.ts`
  (generic `rest_lang`), `components/shell-i18n.ts`, `lib/brand.ts`,
  dict-driven `staff-shell.tsx`. These were built to survive this collapse.

---

## Permission taxonomy (derived from the 9 call sites — not invented)

One permission code per current RBAC group → behavior is reproduced
1:1. Codes are module-scoped to match the `permissions(code, module)`
schema.

| Code | Module | Granted to (= current RBAC list) |
|---|---|---|
| `billing.process` | billing | cashier, manager |
| `identity.manage` | identity | manager |
| `ordering.operate` | ordering | server, kitchen, manager |
| `ordering.staff` | ordering | server, kitchen, cashier, manager |
| `kitchen.operate` | kitchen | kitchen, manager |
| `dining.serve` | dining | server, manager |
| `dining.cashier` | dining | server, cashier, manager |
| `dining.manage` | dining | manager |
| `catalog.manage` | catalog | manager |

**Single source of truth.** This table feeds three things that MUST NOT
drift: (a) the seed migration, (b) the middleware permission check, (c)
the client tree. If they diverge you get silent over- or
under-permissioning. Keep the canonical list in one Go file
(e.g. `platform/auth/permissions.go`) and have the seed + middleware read
from it where practical.

> Codes can be split finer later (e.g. `catalog.read` vs `catalog.write`).
> Start coarse = exact regression parity. Refine only with a deliberate
> behavior change.

---

## Build order (each step ships green / behavior-neutral until step 5)

### Step 1 — Permission taxonomy + seed migration

- New migration `00004_seed_permissions.sql`:
  - `INSERT INTO permissions` (9 codes above, with module + display_name).
  - `INSERT INTO role_permissions` joining seeded role names → codes per
    the matrix.
  - Idempotent (`ON CONFLICT DO NOTHING`), reversible `-- +goose Down`.
- Nothing in the app reads these yet → pure data, no behavior change.
- **Verify:** query `role_permissions` joined to roles reproduces the table
  above.

### Step 2 — Backend: permission resolution + middleware migration

- **Resolver**: `user → role_id → role_permissions → []code`. Add a repo
  method + a small cache (perms change rarely; cache per-role with
  invalidation, or just per-request for v1).
- **Middleware**: introduce `auth.RequirePermission(code string)`. Migrate
  the 9 call sites from `RBAC("ROLE", ...)` to the matching permission
  code. Keep `RBAC` until all sites migrate, then delete.
  - The middleware needs the user's permission set. Two options: resolve
    per-request from DB (simple, 1 query), or carry codes in context after
    JWT (needs delivery decision, step 3). **Recommend per-request resolve
    for the gate** so the JWT stays small and perms can't go stale on the
    server side.
- **Verify (critical):** every one of the 9 endpoints still
  allows/denies the same roles as before. This is the auth-bypass guard —
  reviewer confirms no endpoint lost its server gate.

### Step 3 — Delivery: how the tree reaches the client  ⚠ DECISION FORK

Face-value reading of "return to client on login" = login response body.
Recommended shape:

- **JWT keeps identity only** (`user_id`, `restaurant_id`, `role`). Do NOT
  embed the full permission tree in the JWT — token bloat, and it goes
  stale when perms change (can't revoke without forcing re-login).
- **Login response body** carries the resolved permission codes for first
  paint.
- **Add `GET /api/v1/identity/me`** returning `{ user, role, permissions[] }`
  so the client can refetch without re-login (and on app boot/refresh).

> **Needs your call:** (A) recommended above — JWT=identity, body+`/me`
> carry perms; or (B) embed codes in JWT (simpler, but stale perms +
> bigger token + revocation pain). Defaulting to (A) unless you veto.

### Step 4 — Frontend: PermissionProvider replaces role gates

- `lib/permissions.ts`: `PermissionProvider` (loads codes from login
  response, refetches via `/me`), `usePermission(code): boolean`,
  `useHasAny(codes[])`.
- Replace `isStaffAuthenticated(role)` call sites with `usePermission`.
- Nav items in `shell-i18n.ts` / `staff-shell.tsx` gate on codes, not
  roles. Feature surfaces (buttons, sheets) gate on codes.
- `StaffRole` union starts dissolving — keep a thin compat shim during
  migration, delete at step 5.

### Step 5 — Route collapse (phased, the irreversible part)

Phase it so the app stays shippable at each commit:

1. Stand up **one shell route** (e.g. `app.tsx` or reuse `admin.tsx`'s
   shell) rendering feature panels by permission code — alongside the
   existing 4 routes.
2. Migrate each feature surface (cashier → billing panel, waiter → dining
   panel, kitchen → kitchen panel) **into** the shell, gated by its code.
3. Point old role routes (`cashier.tsx`, `waiter.tsx`, `kitchen.tsx`) at a
   redirect to the shell.
4. Delete the dead route files + the `StaffRole` union once nothing imports
   them.

Builds directly on the already-shipped `use-lang` / `shell-i18n` / `brand`
work.

### Step 6 — Tie-ins

- **Role/permission management is a high-impact surface.** Any UI that edits
  `role_permissions` must use the confirm-gate + write to `audit_logs`
  (`action`, `entity_type='role_permission'`, `old_values`/`new_values`).
  See `high-impact-action-policy` memory.
- **Update memory** `auth-route-policy`: the RBAC map is no longer "guessed"
  — the 9-call-site matrix above is the confirmed source.

---

## Decisions (locked 2026-06-05)

1. **Delivery** → (A) JWT carries identity only; login response body carries
   permission codes; add `GET /api/v1/identity/me` to refetch. Server gate
   resolves perms per-request (token stays small, perms never stale).
2. **Granularity** → coarse, 1 code per RBAC group (the 9 codes). Exact 1:1
   regression parity. Read/write splits deferred to a later deliberate pass.
3. **Shell route** → evolve `admin.tsx` into the unified shell (reuse the
   overhauled dict-driven shell + lang switcher + brand). No new `app.tsx`.
4. **Custom roles** (admin-editable `role_permissions`, `roles.is_system`)
   → **v2, out of scope** for this pass. This pass ships the fixed seeded
   matrix only. Step 6's audit-log/confirm-gate tie-in lands when v2 builds
   the role-management UI.
