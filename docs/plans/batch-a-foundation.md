# Batch A — Foundation (codex implementation spec)

Status: **ready for codex**. Scope locked to Batch A only. This file is both the
implementation spec for codex and the review rubric for the reviewer.

## 0. Why this batch first

The DB schema (`backend/migrations/00001_init_restaurant_schema.sql`) is complete
(35 tables). Everything above it is a uniform skeleton: **every** application
use-case and **every** repository method returns `apperr.ErrNotImplemented`. The
domain models are thin placeholders and every module shares one generic
`application.Input`/`application.Output` wired through a reflection-y `handle()`
glue in each HTTP handler.

Nothing works end-to-end yet. Batch A implements the **smallest foundational
vertical slice — staff login** — and in doing so **establishes the conventions**
every later batch copies. Get the pattern right here; later stories become
"follow the reference."

Stories in scope: **US-001** (staff login), **US-062** (tenant isolation),
plus **demo seed data** so there is something to authenticate against.

Out of scope (do NOT touch): dining/ordering/kitchen/billing/catalog use-cases,
realtime/outbox, the full Q10 menu catalog (seed only what login needs — see §5).

---

## 1. Conventions to establish (the reference patterns)

These are the high-value decisions. Every later module copies them, so they must
be deliberate here, not reinvented per use-case.

### 1.1 Per-use-case DTOs — replace the generic `Input`/`Output` + `handle()`

The current pattern (one `application.Input`/`Output` per module, dispatched by a
`handle()` that reflects over a single `Handle(ctx, Input) (Output, error)`) does
not survive real implementation — each use-case needs its own request/response
shape. Replace it.

Target shape (illustration for identity/authenticate):

```go
// application/authenticate.go
type AuthenticateRequest struct {
    RestaurantCode string `json:"restaurant_code"`
    Username       string `json:"username"`
    Password       string `json:"password"`
}
type AuthenticateResponse struct {
    Token        string    `json:"token"`
    UserID       uuid.UUID `json:"user_id"`
    Role         string    `json:"role"`          // uppercase, e.g. "MANAGER"
    RestaurantID uuid.UUID `json:"restaurant_id"`
    ExpiresAt    time.Time `json:"expires_at"`
}
func (s *Authenticate) Handle(ctx context.Context, req AuthenticateRequest) (AuthenticateResponse, error)
```

Handler binds the concrete request type directly (no shared `Input`, no
reflection glue):

```go
func (h *Handler) authenticate(c *gin.Context) {
    var req application.AuthenticateRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        httpx.RespondError(c, apperr.Wrap(apperr.CodeInvalid, "invalid request body", err))
        return
    }
    out, err := h.authn.Handle(c.Request.Context(), req)
    if err != nil { httpx.RespondError(c, err); return }
    httpx.Respond(c, http.StatusOK, out, nil)
}
```

- **Delete** the generic `application.Input`/`Output` for the identity module and
  the reflection-based `handle()` helper in `identity/interfaces/http/handler.go`.
  Leave the other modules' generic DTOs alone for now (they stay stubbed).
- **Bug to fix while here:** the old `handle()` passes the raw gin bind error to
  `RespondError`; `MapError` has no case for it and returns **500**. Wrapping it as
  `apperr.CodeInvalid` (→ 400) as shown above is mandatory.

### 1.2 JWT issuing helper (does not exist yet)

`auth.JWT` validates; there is no issuer. Add one to `internal/platform/auth`:

```go
// auth.go (or token.go in same package)
func Issue(secret string, claims Claims, ttl time.Duration) (string, error) {
    now := time.Now()
    claims.RegisteredClaims = jwt.RegisteredClaims{
        IssuedAt:  jwt.NewNumericDate(now),
        ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
    }
    return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}
```

- Must round-trip with the existing `JWT` middleware (HS256, same `Claims`).
- `Claims.Role` is set to the **uppercase** role name (see §1.4).
- TTL comes from config (see §4); do not hardcode.

### 1.3 Tenant propagation

`internal/platform/tenant` already provides `WithRestaurantID` /
`MustRestaurantID`. The `auth.JWT` middleware already injects `restaurant_id` from
the token into the request context.

- Authenticated use-cases read tenant via `tenant.MustRestaurantID(ctx)` and pass
  it to every repo call.
- **Login is the bootstrap exception:** it is a public route with no token yet, so
  it resolves the restaurant from `restaurant_code` in the request body, not from
  context. Document this in a comment.

### 1.4 Repository tenant filtering (US-062)

Every repository SQL query MUST filter by `restaurant_id` (and `deleted_at IS NULL`
where the column exists). Real repo methods take the tenant id explicitly from the
use-case (sourced from `tenant.MustRestaurantID`), never trusting a client-supplied
id on an authenticated path.

Role-name case: seed `roles.name` is lowercase (`manager`, `cashier`, `server`,
`kitchen`); RBAC + route groups expect uppercase (`MANAGER`, ...). **Login maps
`strings.ToUpper(role.name)` into the claim.** This keeps RBAC unchanged. Codex must
not silently change the seed casing or the RBAC strings — the mapping lives in the
login use-case.

### 1.5 Password hashing

Use `golang.org/x/crypto/bcrypt` (already an indirect dep — promote to direct).
`bcrypt.DefaultCost`. Compare with `bcrypt.CompareHashAndPassword`. The seed writes
bcrypt hashes into `users.password_hash`.

### 1.6 Error mapping (reuse, don't reinvent)

`apperr` codes + `httpx.RespondError`/`MapError` already exist and are complete. Use
them. Login failures: return `apperr.New(apperr.CodeUnauthorized, "invalid credentials")`
for **both** unknown user and bad password (no user enumeration). Locked/inactive
user → `CodeForbidden`. Missing restaurant_code/username/password → `CodeInvalid`.

---

## 2. US-001 — Staff login

> As a staff member, I want to log in, so that I can access the tools for my role.

Acceptance criteria → checklist:

- [ ] Valid `{restaurant_code, username, password}` returns a signed JWT whose claims
      carry `user_id`, uppercase `role`, and `restaurant_id`.
- [ ] Invalid credentials (unknown user OR wrong password) return
      `401 unauthorized` with a generic message (no enumeration).
- [ ] `status = 'INACTIVE'` or `'LOCKED'` (or `locked_until` in the future) →
      `403 forbidden`, no token.
- [ ] Token validates through the existing `auth.JWT` middleware and lets the holder
      pass `RBAC` for their role.
- [ ] On success, `users.last_login_at` is updated (and `failed_login_attempts`
      reset to 0). On failure, increment `failed_login_attempts`. (Lockout
      thresholds are out of scope — just maintain the counter.)

Work items:
- `identity/domain/model.go`: flesh out `User` (id, restaurant_id, username,
  password_hash, full_name, status, role_id, role_name) and the
  `UserRepository` interface — add e.g.
  `FindByUsername(ctx, restaurantID uuid.UUID, username string) (*User, error)`,
  `ResolveRestaurantIDByCode(ctx, code string) (uuid.UUID, error)`,
  `RecordLoginSuccess(ctx, restaurantID, userID uuid.UUID) error`,
  `RecordLoginFailure(ctx, restaurantID, userID uuid.UUID) error`.
  (Restaurant lookup may instead live in a tiny separate query method — keep it in
  the identity repo for this batch.)
- `identity/application/authenticate.go`: real orchestration (resolve restaurant →
  find user → bcrypt compare → status check → issue token → record login). Wrap in
  `tx.Run`. `NotFound`/bad password collapse to `CodeUnauthorized`.
- `identity/infrastructure/postgres/identity_repository.go`: real SQL via the
  tx-aware querier (see §3), every query restaurant-scoped.
- `identity/interfaces/http/handler.go`: per-use-case binding for `authenticate`;
  drop the generic glue. Keep `manage-users` route returning `ErrNotImplemented`
  for now (US-004 is a later batch) — but it must compile against the new handler
  shape.

---

## 3. Transaction / querier wiring (read before writing repos)

`postgres.TxManager` and the `application.TxRunner` interface already exist
(prior session). Codex must confirm **how a repository obtains the active
`pgx.Tx`/conn inside `tx.Run`** before writing SQL:

- Inspect `backend/internal/platform/postgres/tx.go` for the context key the
  `TxManager` uses to stash the transaction.
- Repos must execute through that tx when present (so the use-case's `tx.Run`
  actually wraps the writes), falling back to the pool otherwise. If a shared
  "querier from context" helper does not exist, **create one** in the postgres
  platform package — this is itself a reference convention for every later repo.
  Do not have each repo reach into the pool directly and bypass the transaction.

This is the one area where the skeleton may be underspecified; resolve it
explicitly and document the chosen helper in the plan's follow-up notes.

---

## 4. Config additions

Add to `internal/platform/config`:
- `JWTTTL time.Duration` — env `JWT_TTL`, default `12h` (staff shift). Use existing
  `durationEnv` helper.
- Confirm `JWTSecret` is already threaded to the identity handler wiring in
  `cmd/api/main.go` (it is, via `wireRoutes(..., cfg.JWTSecret)`); the issuer needs
  the same secret + the new TTL passed into `NewAuthenticate` (or the handler).

---

## 5. Demo seed

Add `backend/cmd/seed/main.go` — idempotent (`ON CONFLICT DO NOTHING` / guarded
inserts), safe to run repeatedly. Seeds the **minimum to exercise login**:

- 1 restaurant (known `code`, e.g. `DEMO`).
- 1 user per system role (manager/cashier/server/kitchen), each with a known
  dev password (bcrypt-hashed at seed time), `status = 'ACTIVE'`, linked to the
  matching `roles` row by `role_id`.
- (Optional, cheap) 1–2 areas + tables + an active QR row, so Batch B has a table to
  join — but no menu items yet.

**Defer the full Q10 hotpot/grill/noodle catalog to Batch B** (menu browse is where
it's first needed). Note this deferral in the seed file header.

Run via `go run ./cmd/seed` against a migrated DB. README/Makefile: add a
`make seed` target mirroring the existing `migrate` target.

Print the seeded restaurant_code + usernames (NOT passwords) on completion.

---

## 6. Tests codex must produce

Mirror the existing testify/`gin.TestMode` + `httptest` style already in the repo
(`internal/platform/httpx/middleware_test.go`, `auth/auth_test.go`).

- `auth.Issue` round-trips through `auth.JWT` (issue → parse → claims match,
  including uppercase role); expired token (negative TTL) is rejected.
- Authenticate use-case (table-driven, repo faked/stubbed): success returns token;
  unknown user → `CodeUnauthorized`; wrong password → `CodeUnauthorized`;
  inactive/locked → `CodeForbidden`; role string is uppercased.
- HTTP handler: malformed JSON body → **400** (proves the bind-error fix), not 500.
- Repository SQL tests are NOT required for this batch (no test DB harness exists
  yet); if codex adds one it must be opt-in/skipped when no DB env is set.

Whole suite must stay green: `go build ./... && go vet ./... && go test ./...`.

---

## 7. Review rubric (reviewer fills this on the codex diff)

- [ ] Generic `Input`/`Output` + reflection `handle()` removed from identity only;
      other modules untouched and still compile.
- [ ] Bind errors map to 400, not 500.
- [ ] `auth.Issue` exists, HS256, TTL from config, round-trips with `auth.JWT`.
- [ ] Role claim is uppercase; RBAC strings + seed casing unchanged.
- [ ] Login resolves restaurant from `restaurant_code` (bootstrap), all other
      identity queries are restaurant-scoped (US-062).
- [ ] bcrypt used; no plaintext; no user enumeration in error messages.
- [ ] Repos execute inside the use-case transaction via the §3 querier helper, not
      by bypassing to the pool.
- [ ] Seed is idempotent and only seeds login essentials (no full catalog).
- [ ] Tests present per §6; `build`/`vet`/`test` all green.
- [ ] No secrets/passwords logged or committed.

---

## 8. Dependency-ordered follow-on batches (NOT for this handoff)

B Guest entry (US-005/006/007 join + US-012/013/014 menu browse; resolve Q18
  session-token storage — `dining_sessions` has `session_code` but no random
  revocable token column, likely needs a migration). C Ordering
  (US-020/021/022/030/033). D Kitchen (US-034..038). E Realtime
  (US-054..057 — requires outbox made real + `hub.Broadcast` topic filtering; its
  own chunk, not bundled into ordering). F Billing (US-046..053). G Reporting
  (US-058..061, greenfield module).

## 9. Batch A implementation note

Repository transaction convention: `internal/platform/postgres.QuerierFromContext`
returns the active `pgx.Tx` stashed by `TxManager.Run`, or falls back to the pool
when no transaction is present. Batch A identity SQL uses this helper so login
success/failure writes participate in the use-case transaction.

Restaurant-code convention: restaurant codes are canonical uppercase. The
identity login path uppercases request codes, and migration
`00002_normalize_restaurant_codes.sql` normalizes writes at the DB boundary so
future restaurant-create paths cannot persist mixed/lowercase codes.
