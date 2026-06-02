# Batch B1 — Guest entry & session auth (codex implementation spec)

Status: **ready for codex**. Depends on Batch A (merged). This file is the
implementation spec for codex and the review rubric for the reviewer.

Batch B is split: **B1 = dining sessions + guest auth primitive (this file)**;
**B2 = menu browse (token-gated), separate handoff after B1 merges.** B2 depends on
B1's middleware, so B1 is forced first.

## 0. Scope

Stories: **US-008** (staff open session), **US-005/006/007** (guest QR join),
plus the **guest session-token auth primitive** that B2 and Batch C ride on.

Product decisions driving this batch (resolved with the user):
- **Staff opens, guest joins** (Q18 wins over US-006's literal "guest scan creates").
  Staff POS "Open Table" creates the session and its token; the guest QR scan only
  *joins* an already-open session. No active session → "table not opened" greeting.
- **Menu browse is session-token gated** (B2) → the `QRSessionToken` middleware is
  built here in B1.

Out of scope (do NOT touch): ordering/kitchen/billing use-cases; catalog **write**
stubs; the menu **read** endpoints (those are B2). `close-session` /
`manage-table-qr` may stay stubbed unless trivially needed — see §6.

## 1. Conventions (reuse Batch A — do not reinvent)

- **Per-use-case DTOs** + direct handler binding; bind errors wrapped as
  `apperr.CodeInvalid` (→400). No reflection `handle()` glue. (Pattern set in
  `identity` — copy it for the new dining endpoints.)
- **Repos run through `postgres.QuerierFromContext`** inside `tx.Run` (Batch A §3).
- **Tenant from context** for authenticated paths via `tenant.MustRestaurantID`.
  Staff endpoints get it from the JWT middleware; guest endpoints get it from the
  new session middleware (§3). Public `join-session` resolves tenant from the QR
  token itself (bootstrap exception, like login did from restaurant_code).
- **Unique-violation mapping**: a Postgres unique violation (SQLSTATE `23505`) must
  map to `apperr.CodeConflict` (→409), never bubble as 500. Add a small helper in
  the postgres platform package (e.g. `IsUniqueViolation(err error) bool` using
  `*pgconn.PgError`); use it wherever a unique index can fire.

## 2. Session token model (READ THIS — it is the security primitive)

- New column on `dining_sessions`: `session_token VARCHAR(255) NOT NULL UNIQUE`.
- Generated at **open-session** time: `crypto/rand`, 32 bytes, base64url-encoded.
- **Stored RAW (not hashed).** Rationale: the token is a *shared, per-session*
  bearer value that `join-session` must hand back to the guest at join time — hashing
  at open would destroy the raw value before join can return it. Hashing is only
  compatible with per-guest tokens, which contradicts Q18's singular "the
  session_token" + US-007 shared-session semantics. This matches the existing
  `qr_codes.token` posture (also raw, and a longer-lived secret). Note the deferral
  in a comment.
- **Revocation is by status, not mutation.** Do NOT null the token on close. The
  middleware validates token AND `status IN ('ACTIVE','AWAITING_PAYMENT')` in one
  lookup. A `CLOSED` session's token is therefore rejected ("permanently revoked"
  per Q18) while the value survives for audit; a later session on the same table
  gets a fresh token.
- Guest presents it in the **`X-Session-Token`** header (NOT `Authorization` — that
  carries staff JWTs; avoid collision on shared endpoints like `/ws`).

### Migration `backend/migrations/00002_session_token.sql`
- goose Up/Down (mirror 00001's format and the embed at `migrations/embed.go`).
- Up: `ALTER TABLE dining_sessions ADD COLUMN session_token VARCHAR(255);` then
  populate any existing rows? (None in practice — greenfield.) Then add the unique
  constraint/index. Because the column is added to a possibly-non-empty table in
  theory, add it nullable, then `CREATE UNIQUE INDEX uq_dining_sessions_token ON
  dining_sessions(session_token) WHERE session_token IS NOT NULL;` — open-session
  always sets it. (Simpler than NOT NULL backfill; documents intent.)
- Down: drop index, drop column.

## 3. Guest session middleware — `auth.QRSessionToken`

`auth.QRSessionToken` is currently a stub returning 501. Implement it to gate guest
routes:

- Reads `X-Session-Token`. Missing/empty → 401 `CodeUnauthorized`.
- Looks up the session by token, requiring `status IN ('ACTIVE','AWAITING_PAYMENT')`
  and `deleted_at IS NULL`. Not found / wrong status → 401 (generic, no enumeration).
- On success injects into request context:
  - `tenant.WithRestaurantID(ctx, restaurantID)` — so guest use-cases use the SAME
    `tenant.MustRestaurantID` convention as staff. **This is the clean reuse — B2's
    menu reads need no special-casing.**
  - guest session info (session_id, table_id) via a small new context package
    `internal/platform/guest` (`WithSession`/`SessionFromContext`), for Batch C
    ordering to consume.

The middleware needs a DB lookup but lives in `platform/auth` (no repo import). Inject
a validator interface, dining provides the implementation, wire in `main.go`:

```go
// platform/auth
type SessionValidator interface {
    ValidateSessionToken(ctx context.Context, token string) (SessionAuth, error)
}
type SessionAuth struct{ RestaurantID, SessionID, TableID uuid.UUID }
func QRSessionToken(v SessionValidator) gin.HandlerFunc { ... }
```

Keep `SessionAuth`/the interface in `platform/auth` (or `platform/guest`) so there's
no import cycle with the dining module.

## 4. US-008 — Staff open session

> As a server, I want to open a walk-in session, so that guests can be served.

Route: `POST /api/v1/dining/open-session`, staff (`RBAC("SERVER","MANAGER")`),
tenant from JWT. Body: `{ "table_id": "<uuid>" }` (accept table_id; table_code
optional later).

Checklist:
- [ ] Table must belong to the caller's restaurant and not be soft-deleted → else
      404.
- [ ] Creates `dining_sessions` row: `status='ACTIVE'`, `opened_via='STAFF'`,
      `opened_by=<user_id from claims>`, `qr_code_id`=the table's active QR (if any),
      generated unique `session_code`, generated `session_token` (§2).
- [ ] Duplicate live session blocked by `uq_dining_sessions_one_open_per_table` →
      handler maps the 23505 to **409 conflict** (this satisfies **US-006**'s
      "duplicate live sessions are blocked"). 
- [ ] Response returns session_id, session_code, table_id, status, and the
      `session_token` (staff hands the table its QR; token is what guests will
      receive on join). VND/other fields not needed.

## 5. US-005/006/007 — Guest join session

> Guest scans the static table QR to join the active session.

Route: `POST /api/v1/dining/join-session`, **public** (no JWT, no session token yet).
Body: `{ "qr_token": "<static qr_codes.token>" }`.

Checklist:
- [ ] Resolve `qr_codes` by token requiring `is_active = TRUE` and not deleted →
      yields restaurant_id + table_id. Unknown/inactive QR → 401 (generic).
- [ ] Find the active session for that (restaurant, table) with
      `status IN ('ACTIVE','AWAITING_PAYMENT')`.
- [ ] **Active session found** → 200, return `session_token`, session_id, table_id,
      restaurant_id, status. Repeated scans return the SAME active session's token
      (US-007 multi-guest shared session — naturally idempotent, no new row).
- [ ] **No active session** → Q18 "table not yet opened". **Pinned contract:** HTTP
      **200** with body `{ "status": "not_opened" }` and no token (this is a normal
      greeting state, not an error — the frontend renders the waiting screen). Do
      NOT 404/500 here.
- [ ] Guest never creates a session (Q18). US-006 "session created when none exists"
      is satisfied by staff **open-session** (§4), not here.

Note: real `qr_codes.token` values are random/high-entropy (knowing one = proving
physical presence at the table, which is what gates handing out the session token).
Seed's `'DEMO-T01'` is a demo placeholder only.

## 6. Dining domain / repo work

- `dining/domain/model.go`: extend as needed — `DiningSession` gains `SessionCode`,
  `SessionToken`, `OpenedVia`, `OpenedBy`, `QRCodeID`; add lookups to
  `DiningRepository`:
  - `FindTable(ctx, restaurantID, tableID) (*Table, error)`
  - `ActiveQRForTable(ctx, restaurantID, tableID) (*QRCode, error)` (or fold into table)
  - `CreateSession(ctx, *DiningSession) error`
  - `ResolveQRToken(ctx, qrToken) (restaurantID, tableID uuid.UUID, err error)`
  - `FindActiveSessionByTable(ctx, restaurantID, tableID) (*DiningSession, error)`
  - `FindSessionByToken(ctx, token) (SessionAuth, error)` — for the middleware
    validator; restricts to ACTIVE/AWAITING_PAYMENT.
- Replace the dining module's generic `Input`/`Output` + reflection `handle()` with
  per-use-case DTOs and direct handlers (same as identity in Batch A).
- `close-session` / `manage-table-qr`: keep returning `ErrNotImplemented` but they
  MUST compile against the new handler shape. (Closing sessions = Batch F; QR rotation
  US-011 = later.) If trivial, leaving stubbed is fine — do not expand scope.

## 7. Wiring (`cmd/api/main.go`)
- Construct the dining repo, build the `SessionValidator`, register guest-gated
  route group with `auth.QRSessionToken(validator)` (no guest routes consume it in
  B1 except readiness for B2 — it's fine to wire the middleware and have B2 add the
  menu routes under it; or add an empty guest group now and B2 fills it). Keep it
  minimal; don't add menu routes here.
- `open-session` under the existing staff dining group; `join-session` public.

## 8. Tests
Mirror Batch A style (testify, faked repo for use-cases; `httptest` + `gin.TestMode`
for handlers; round-trip for the middleware with a fake validator).
- open-session: success sets status/opened_via/token; non-existent table → 404;
  duplicate (validator/repo returns 23505) → 409.
- join-session: active session → token returned; repeated join → same token; no
  active session → 200 `{status:"not_opened"}`, empty token; unknown/inactive QR →
  401.
- `QRSessionToken` middleware: valid ACTIVE token → injects restaurant_id (assert a
  downstream handler sees `tenant.MustRestaurantID`); CLOSED/missing/unknown → 401.
- unique-violation helper: returns true for a `*pgconn.PgError{Code:"23505"}`.
- Suite stays green: `go build ./... && go vet ./... && go test ./...`.

## 9. Review rubric
- [ ] Migration 00002 adds `session_token` + unique index; Down reverses; embed picks
      it up; `go run ./cmd/migrate up` story documented (not run in CI).
- [ ] Token: crypto/rand base64url, stored RAW, NOT NULL via open-session; revocation
      by status (token never nulled on close).
- [ ] `QRSessionToken` validates token AND status, injects tenant + guest session;
      uses `X-Session-Token`; generic 401 on failure.
- [ ] open-session: tenant from JWT, table ownership checked, duplicate → 409 (not
      500), token+code generated.
- [ ] join-session: public, QR→table→active session; no-session → 200 not_opened
      (pinned), not an error; idempotent for multi-guest; generic 401 on bad QR.
- [ ] Dining generic Input/Output + reflection glue removed; other modules untouched;
      catalog reads NOT added here.
- [ ] No token/secret logged. Tests per §8. build/vet/test green.

## 10. After B1 → B2 preview (separate handoff)
Menu browse, token-gated, reusing B1's middleware + `tenant.MustRestaurantID`:
US-012 categories, US-013 item list (availability, base price, variant summary),
US-014 item detail (variants + option groups with min/max selection limits). New
per-use-case read DTOs in catalog; leave catalog write stubs alone. Then Batch C
(ordering) consumes `guest.SessionFromContext` for placing orders.
