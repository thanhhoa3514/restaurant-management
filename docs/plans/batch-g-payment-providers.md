# Batch G — Async e-wallet payment providers (MoMo + ZaloPay) (codex implementation spec)

Status: **ready for codex**. Depends on **F** (billing build/adjust/process-payment, payments
table writes, `payment_methods` seed, dining close-session). This file is the implementation
spec for codex and the review rubric for the reviewer.

Batch F made the cashier real but payment is **cash-register style**: cashier types a received
amount and the payment row is written `COMPLETED` instantly. The e-wallet methods (`momo`,
`zalopay`) are labels only — no QR, no redirect, no provider confirmation. G adds a real
**asynchronous** e-wallet flow: initiate → provider QR/deeplink → customer pays → provider
webhook → reconcile → invoice PAID + session closed.

## 0. PINNED decisions (READ THIS FIRST)

- **Providers:** MoMo + ZaloPay only. CASH/CARD keep F's synchronous instant-complete path
  untouched. Provider-agnostic **gateway port** abstraction so a third provider is an adapter,
  not a rewrite.
- **Build mode:** **mock-simulator-first.** Codex builds the full async state machine
  (`PROCESSING` → webhook → `COMPLETED`) end-to-end against an **in-repo `mock` provider** plus
  a dev-only "fire signed webhook" endpoint. NO external sandbox creds, NO public tunnel needed
  to prove the loop. The MoMo and ZaloPay adapters are implemented to real sandbox API/signature
  shapes but are exercised in tests with stubbed HTTP; real sandbox keys are wired later via
  config, no code change.
- **No migration.** Schema already has every column: `payments.gateway_transaction_id`,
  `payments.transaction_data` (JSONB), `payment_methods.config` (JSONB), and the
  `payment_webhook_events` table. Existing schema is authoritative — do not add migrations.
- **Realtime is free.** `outbox.NewDispatcher(pool, hub, log)` already relays outbox events to
  the `/ws` hub. Frontend `RealtimeProvider` (`frontend/src/lib/realtime.tsx`) invalidates the
  `['staff']` query on any `billing.*` event. The webhook writes `billing.payment_completed` (same
  event F emits) → cashier's `staff/tables` query refetches → paid session reconciles. **No polling
  endpoint, no SSE.** Do not add a status-poll route unless section 9 says so.
- **Money is never trusted from the provider.** The webhook's amount must equal the stored
  `payments.amount_vnd`; mismatch → reject, do not mark PAID.

## 1. The spine — flow map

| Step | Actor | Endpoint / mechanism | Result |
|---|---|---|---|
| pick e-wallet, confirm | cashier | `POST /billing/process-payment` (method=`momo`/`zalopay`) | payment row `PROCESSING`, gateway initiated, returns QR/deeplink. Session NOT closed. |
| scan & pay | customer | provider app | provider sends server-to-server webhook |
| provider confirms | provider | `POST /billing/payments/webhook/:provider` (public, signature-auth) | verify sig → reconcile → invoice PAID, session CLOSED, table freed, `billing.payment_completed` outbox → ws push |
| cashier sees "paid" | cashier | existing `/ws` listener | UI flips to paid from the pushed event |
| (dev) simulate pay | dev | `POST /billing/payments/mock/complete` (env-gated) | fires a correctly-signed `mock`-provider webhook into the real handler |

CASH/CARD are unchanged: `process-payment` still writes `COMPLETED` synchronously and closes the
session in the same tx (F section 7). **The async branch is selected by `payment_methods.type`**
(`E_WALLET`) **+ a gateway being registered for that code**, not by method code string matching.

## 2. Conventions (same as F)

- Hexagonal: `domain` (gateway port + types), `application` (orchestration), `infrastructure`
  (provider adapters + repo SQL), `interfaces/http` (handlers). No module imports another's
  application layer. Cross-module reads via direct SQL only.
- `tx.Run`, `postgres.QuerierFromContext`, `apperr` codes, `outbox.WriteEvent`, random codes via
  the existing `randomCode`/`randomToken` helpers (`billing_repository.go`).
- snake_case JSON, VND `int64`, soft delete, optimistic `version`, `httpx.Respond`/`RespondError`.
- HTTP calls to providers go through an injected `*http.Client` with a timeout, never
  `http.DefaultClient`. Adapters take their config (endpoint, keys) by struct, sourced from env
  in `cmd/api/main.go` — never hardcode keys.

## 3. The gateway port (new — `billing/domain/gateway.go`)

```go
type PaymentGateway interface {
    // Provider returns the canonical key: "momo" | "zalopay" | "mock".
    Provider() string
    // Initiate asks the provider to create a payment intent. Returns the gateway
    // transaction id + the customer-facing QR/redirect handles.
    Initiate(ctx context.Context, in InitiateInput) (InitiateResult, error)
    // ParseWebhook verifies the signature over the raw body and returns a normalized event.
    // A signature/parse failure returns apperr CodeUnauthorized / CodeInvalid.
    ParseWebhook(ctx context.Context, raw []byte, headers http.Header) (WebhookEvent, error)
}

type InitiateInput struct {
    PaymentNumber string // our globally-unique order ref (orderId / app_trans_id seed)
    AmountVND     int64
    Description   string
    ReturnURL     string // browser redirect after pay (cashier UI)
    IPNURL        string // server-to-server webhook URL for this provider
}

type InitiateResult struct {
    GatewayTransactionID string         // provider's id; stored on payments.gateway_transaction_id
    PayURL               string         // redirect URL (may be empty)
    Deeplink             string         // app deeplink (may be empty)
    QRCodeURL            string         // QR image/string for on-screen scan
    Raw                  map[string]any // persisted to payments.transaction_data
}

type WebhookEvent struct {
    Provider             string
    EventID              string         // provider event/transaction id → payment_webhook_events.event_id (idempotency)
    GatewayTransactionID string         // to match the payment row
    OrderRef             string         // our PaymentNumber echoed back
    AmountVND            int64          // MUST equal stored payments.amount_vnd
    Status               PaymentStatus  // COMPLETED | FAILED (map provider result codes)
    Raw                  map[string]any
}
```

A `GatewayRegistry` (simple `map[string]PaymentGateway` keyed by provider code) is built in
`cmd/api/main.go` and injected into the application services. Registry lookup by
`payment_methods.code`. If a method is `E_WALLET` but has no registered gateway → `process-payment`
returns `CodeNotImplemented` ("payment provider not configured") — never silently fall back to
instant-complete.

## 4. process-payment changes (`application/process_payment.go` + repo)

**Branch placement (read first — F's validation order collides here).** F's app layer validates
`ReceivedAmountVND <= 0 → CodeInvalid` **unconditionally, before any method lookup**. That guard is
sync-only. Inject the `GatewayRegistry` into `ProcessPayment`; resolve the method first, then:
`registry.Has(methodCode) && method.type == "E_WALLET"` selects the **async** path; everything else
is **sync**. The `received > 0` / `received >= total` guards apply to the **sync path only** — move
them inside that branch. (Consequence: rubric item 2's "byte-for-byte equivalent to F" means *the
sync branch behaves identically*, not that the file is unchanged — the validation necessarily moves
under the branch.)

Branch on the resolved payment method:

- **Synchronous (CASH/CARD, or any method with no gateway):** unchanged from F. Validate
  `received >= total`, write payment `COMPLETED`, invoice `PAID`, close session, free table,
  emit `billing.payment_completed` + `dining.session_closed`. Done.
- **Async (E_WALLET with a registered gateway):**
  1. Reuse F's preflight guards (invoice exists, not already PAID/VOID/REFUNDED, no existing
     COMPLETED payment). `received_amount_vnd` is **ignored/optional** for async — the customer
     pays `total` via the wallet; do not require it.
  2. **Idempotency:** if a `PROCESSING` payment already exists for this invoice + method, return it
     (re-issue the stored QR from `transaction_data`) instead of creating a second intent.
  3. Insert payment row `status='PROCESSING'`, `amount_vnd = invoice.total_amount_vnd`,
     `payment_number = randomCode("PAY", …)`, `processed_by = actor`, `processed_at = NULL`.
  4. Call `gateway.Initiate(...)` with `PaymentNumber = payment_number`, `IPNURL` = the provider
     webhook URL (from config base URL + `/api/v1/billing/payments/webhook/<provider>`).
  5. `UPDATE payments SET gateway_transaction_id = $..., transaction_data = $... , version=version+1`.
  6. **Do NOT** mark invoice PAID, **do NOT** close the session. Invoice stays `PENDING`.
  7. Return the invoice DTO with `payment.status = "processing"` plus the QR/deeplink/payUrl
     (extend `PaymentDTO`, section 7). Emit outbox `billing.payment_initiated` (Priority 4) so the
     UI can react if it wants; not required for correctness.

  If `gateway.Initiate` fails: the whole `tx.Run` rolls back (no orphan PROCESSING row) and the
  handler returns the provider error mapped to `CodeInternal`/`CodeInvalid`.

`ProcessPaymentRequest` gains nothing client-facing; method code still selects the path. Keep the
existing request shape.

## 5. Webhook handler (`interfaces/http/webhook_handler.go` — replace the stub)

Route: change `RegisterWebhookRoutes` from the single `/billing/payments/webhook` stub to
`POST /billing/payments/webhook/:provider`. **Public — no JWT** (the `api` group has no group-level
auth; do not add `auth.JWT`). Authentication is the provider signature, verified in the adapter.

Handler steps (orchestrated by a new `application/HandleWebhook` service inside `tx.Run`):
1. Look up the gateway by `:provider` from the registry. Unknown → 404, stop.
2. Read the raw body (need the exact bytes for signature verification — use `c.GetRawData()`,
   not a bound struct). `gateway.ParseWebhook(raw, headers)`:
   - signature invalid → `CodeUnauthorized` → respond **401**. Provider will retry; that's correct.
   - unparseable → `CodeInvalid` → **400**.
3. **Tenant resolution (no JWT here):** find the payment row by `gateway_transaction_id`
   (fallback: `payment_number = OrderRef`). The row carries `restaurant_id` — set it into the
   context tenant before any tenant-scoped mutation. If no payment matches → record the event with
   `processing_error` and respond **200** (nothing to do; don't make the provider retry forever).
   Note: this lookup is unambiguous only because `gateway_transaction_id`/`payment_number` are
   random tokens — the DB constraint `uq_payments_gateway_transaction` is per-`(restaurant_id, …)`,
   NOT globally unique by schema. Fine for single-tenant MVP; a multi-tenant future must embed the
   tenant in the provider order ref and verify it, not assume DB-enforced global uniqueness.
4. **Idempotency:** insert into `payment_webhook_events (restaurant_id, provider, event_id,
   payment_id, payload)`. The `UNIQUE (restaurant_id, provider, event_id)` constraint is the guard
   — on conflict, this event was already processed → respond **200**, no state change.
5. **Amount check:** `event.AmountVND == payment.amount_vnd`. Mismatch → set `processing_error`,
   respond **200** (logged, not retried), do NOT mark PAID.
6. Branch on `event.Status`:
   - **COMPLETED** and payment is `PROCESSING`: flip payment → `COMPLETED`
     (`processed_at=NOW()`, store `transaction_data`), invoice → `PAID`
     (`paid_amount_vnd=total`, `change_amount_vnd=0`, `paid_at=NOW()`), **close session + free
     table** (reuse F's repo helper — extract F's close-session-and-free-table block into a shared
     repo method both `ProcessPayment` and the webhook call, do not duplicate the SQL). Emit outbox
     `billing.payment_completed` + `dining.session_closed` (identical payloads to F so the ws
     consumer/UI need no new case).
   - **FAILED:** payment → `FAILED`. Invoice stays `PENDING`, session stays open (cashier can
     retry or switch to cash). Emit `billing.payment_failed` (Priority 4).
   - payment already `COMPLETED`/`FAILED` (late/duplicate provider call): no-op, 200.
7. Mark `payment_webhook_events.processed_at = NOW()`. Respond **200** with a tiny ack body the
   provider expects (MoMo: 204/empty is fine; ZaloPay: `{"return_code":1,"return_message":"OK"}` —
   the adapter, not the generic handler, owns the provider-specific ack via a
   `WebhookAck()` method or a returned ack payload).

Wrap the state mutation in `tx.Run`. Always respond 200 for "handled or safely ignored" so the
provider stops retrying; reserve non-200 for signature failure (401) and malformed body (400).

## 6. Provider adapters (`infrastructure/gateway/`)

One file per provider. Each implements `domain.PaymentGateway`. The field lists and signature
string orders below are **indicative, from recall** — codex MUST confirm each provider's exact
signature concatenation + IPN/callback field order against the current official MoMo / ZaloPay
sandbox docs before trusting them. Mock-first means real-provider correctness is deliberately not
exercised in CI here; the formulas are a starting point, not authoritative. Real sandbox shapes:

### 6a. MoMo (`momo.go`) — captureWallet (AIO v2)
- Initiate: `POST {endpoint}/v2/gateway/api/create`, `requestType="captureWallet"`. Request fields
  `partnerCode, accessKey, requestId, amount, orderId(=PaymentNumber), orderInfo, redirectUrl,
  ipnUrl, extraData, requestType, lang, signature`. **Signature** = HMAC-SHA256(secretKey) over the
  exact alphabetical key=value string MoMo specifies
  (`accessKey=…&amount=…&extraData=…&ipnUrl=…&orderId=…&orderInfo=…&partnerCode=…&redirectUrl=…&requestId=…&requestType=…`).
  Response: `payUrl, deeplink, qrCodeUrl, resultCode` (0 = init OK). Non-zero → error.
- Webhook (IPN): JSON body with `partnerCode, orderId, requestId, amount, transId, resultCode,
  message, signature`. Verify signature over MoMo's documented IPN field order. `resultCode == 0`
  → COMPLETED, else FAILED. `EventID = requestId` (or `transId`); `GatewayTransactionID = transId`;
  `OrderRef = orderId`. Ack: HTTP 204.

### 6b. ZaloPay (`zalopay.go`) — v2
- Initiate: `POST {endpoint}/v2/create`. Fields `app_id, app_trans_id (yymmdd_<PaymentNumber>),
  app_user, amount, app_time, embed_data, item, description, bank_code="", callback_url, mac`.
  **mac** = HMAC-SHA256(key1) over `app_id|app_trans_id|app_user|amount|app_time|embed_data|item`.
  Response: `return_code` (1 = success), `order_url` (→ QRCodeURL/PayURL), `zp_trans_token`.
- Webhook (callback): body `{ "data": "<json string>", "mac": "<hmac>", "type": n }`. **mac** =
  HMAC-SHA256(key2) over the raw `data` string — verify before parsing. `data` JSON has
  `app_trans_id, zp_trans_id, amount`. Map to COMPLETED. `EventID = zp_trans_id`;
  `GatewayTransactionID = zp_trans_id`; `OrderRef` = the `<PaymentNumber>` slice of `app_trans_id`.
  Ack body: `{"return_code":1,"return_message":"success"}`.

### 6c. Mock (`mock.go`) — the simulator (always registered)
- `Provider() = "mock"`. Initiate returns deterministic `GatewayTransactionID =
  "MOCK-"+PaymentNumber`, `QRCodeURL`/`PayURL = {publicBaseURL}/dev/mock-pay/{PaymentNumber}`
  (a placeholder the frontend can render as a QR). No external HTTP.
- `ParseWebhook` verifies an HMAC-SHA256 over the body using a `MOCK_WEBHOOK_SECRET` so the
  signature path is exercised for real.
- Seed a `mock` payment method (`type='E_WALLET'`, code `mock`, name "Mock Wallet") **only when**
  `APP_ENV != "production"` (extend F's `seedPaymentMethods`).

## 7. Response DTO extension (`application/dto.go`)

Extend `PaymentDTO` with the customer-facing handles so the cashier UI can render the QR for an
async payment:

```go
PayURL    string `json:"pay_url,omitempty"`
Deeplink  string `json:"deeplink,omitempty"`
QRCodeURL string `json:"qr_code_url,omitempty"`
```

Populate from `payments.transaction_data` when status is `PROCESSING`. For COMPLETED/CASH payments
these stay empty. `PaymentStatus` lowercased in the DTO already covers `"processing"`.

## 8. Dev simulate endpoint (`interfaces/http/webhook_handler.go`)

`POST /billing/payments/mock/complete` — **registered only when `APP_ENV != "production"`** (guard
in `RegisterWebhookRoutes` or a sibling). Body `{ "payment_number": "PAY-…", "result": "success"|"fail" }`.
It builds a `mock`-provider webhook payload, signs it with `MOCK_WEBHOOK_SECRET`, and calls the
**same** `HandleWebhook` path as a real provider — proving the async loop without a tunnel. Returns
the resulting invoice DTO. This is the end-to-end test seam; do not shortcut it by calling the repo
directly.

## 9. Frontend wiring (Claude, post-review — NOT codex)

Listed so codex keeps the contract stable; Claude implements after F-style review passes:
- `process-payment` for an e-wallet returns `payment.status="processing"` + `qr_code_url`. Cashier
  shows the QR/deeplink and a "waiting for payment" state instead of instant receipt.
- No new fetch loop: the existing `/ws` listener already receives `billing.payment_completed`
  (same event as cash). On that event for the open session, invalidate `STAFF_TABLES_QUERY_KEY`
  and re-render the invoice as paid. `billing.payment_failed` → surface a retry/switch-to-cash
  affordance (the failPayment branch, still local).
- Dev: a "simulate paid" button (env-gated) that POSTs `mock/complete`.

## 10. Config (`cmd/api/main.go` + env)

New env (all optional; absent provider → not registered, method falls back to `CodeNotImplemented`
if selected):
- `PUBLIC_BASE_URL` — for building `ipnUrl`/`callback_url`/`redirectUrl`.
- `MOMO_ENDPOINT`, `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`.
- `ZALOPAY_ENDPOINT`, `ZALOPAY_APP_ID`, `ZALOPAY_KEY1`, `ZALOPAY_KEY2`.
- `MOCK_WEBHOOK_SECRET` (defaulted in non-prod).
Build the `GatewayRegistry` from whichever are present; `mock` always registered in non-prod.
Inject registry into `NewProcessPayment` and the new `NewHandleWebhook`.

## 11. Deferred (NOT in G)

- Refund/void (`payments.refunded_*` columns) and partial/split payments.
- Real provider production keys / KYC / settlement reconciliation reports.
- Provider-initiated expiry/timeout of a `PROCESSING` intent (add a sweeper later); for G a
  stale PROCESSING payment is simply superseded when the cashier switches to cash (which needs the
  refund/void story — so for G, document that switching method while PROCESSING is **blocked** until
  the webhook resolves or a manual void lands).
- CARD as a real terminal integration (stays synchronous instant-complete).

## 12. Tests (codex must add)

- `roundBPS`/money unchanged — not retested here.
- Adapter signature round-trip: build request → sign → verify our own signature; known-vector test
  per provider if a documented sample exists.
- Mock end-to-end: `process-payment(mock)` → assert payment `PROCESSING`, invoice `PENDING`,
  session open → `mock/complete` success → assert payment `COMPLETED`, invoice `PAID`, session
  `CLOSED`, table `AVAILABLE`, exactly one `payment_webhook_events` row.
- Idempotency: fire the same mock webhook twice → second is a no-op (still one COMPLETED payment,
  one event row), 200 both times.
- Tamper: webhook with wrong amount → invoice stays PENDING, `processing_error` set, 200.
- Bad signature → 401, no state change.
- `go build ./...`, `go vet ./...`, `go test ./...` all green.

## 13. Review rubric (reviewer)

1. Async branch never marks PAID/closes session on `process-payment` — only the webhook does.
2. Synchronous CASH/CARD path byte-for-byte equivalent to F (regression check).
3. Webhook is public, signature-verified on **raw** bytes, tenant set from the matched payment row.
4. Idempotency enforced by `uq_payment_webhook_events_provider_event`, not app-level guesswork.
5. Amount equality enforced before PAID. No provider-supplied amount trusted.
6. Close-session-and-free-table SQL is shared (not duplicated) between F's sync path and the webhook.
7. No secret hardcoded; provider HTTP client has a timeout; absent config = method unregistered,
   not a crash.
8. Non-200 only for 401 (bad sig) / 400 (malformed). Everything else handled-or-ignored = 200.
9. `mock/complete` and the `mock` method are env-gated off in production.
10. Outbox events reuse F's `billing.payment_completed` + `dining.session_closed` shapes so the
    existing ws/dispatcher relay needs no change.

## 14. Build order

1. `domain/gateway.go` port + types; `PaymentStatus` already has `PROCESSING`.
2. `mock.go` adapter + registry + config wiring + non-prod seed.
3. Refactor F's close-and-free block into a shared repo method.
4. `application/HandleWebhook` + repo reconcile method; rewrite `webhook_handler.go` route + handler.
5. Async branch in `process_payment.go`; `PaymentDTO` QR fields.
6. `mock/complete` dev endpoint. Full mock end-to-end test.
7. `momo.go` + `zalopay.go` adapters with stubbed-HTTP unit tests.

Items 1–6 are the provable core (no external dependency). Item 7 makes it real-provider-ready;
its live exercise is gated on you supplying sandbox keys + a `PUBLIC_BASE_URL` tunnel.
