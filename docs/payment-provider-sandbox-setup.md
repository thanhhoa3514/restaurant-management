# Payment Provider Sandbox Setup

This guide explains how to configure the payment providers currently wired into the restaurant-management app:

- `mock` — local/dev provider, no external account
- `momo` — MoMo sandbox/production gateway
- `zalopay` — ZaloPay sandbox/production gateway

Official references:

- MoMo integration environments and credentials: <https://developers.momo.vn/v3/docs/payment/onboarding/integration-process/>
- MoMo wallet one-time payment API: <https://developers.momo.vn/v3/docs/payment/api/wallet/onetime/>
- ZaloPay integration process: <https://docs.zalopay.vn/docs/developer-tools/integration-guide/>
- ZaloPay callback verification: <https://docs.zalopay.vn/docs/developer-tools/knowledge-base/callback>
- ZaloPay payment gateway flow: <https://docs.zalopay.vn/docs/guides/payment-acceptance/payment-gateway/intro>

## Shared requirements

All async providers need a public backend URL so provider servers can call the webhook.

```bash
APP_ENV=development
PUBLIC_BASE_URL=https://your-public-api.example.com
```

For local sandbox testing, expose the backend with a tunnel such as ngrok or cloudflared, then set `PUBLIC_BASE_URL` to that HTTPS tunnel URL.

Webhook URLs used by the app:

```text
MoMo:    ${PUBLIC_BASE_URL}/api/v1/billing/payments/webhook/momo
ZaloPay: ${PUBLIC_BASE_URL}/api/v1/billing/payments/webhook/zalopay
Mock:    ${PUBLIC_BASE_URL}/api/v1/billing/payments/webhook/mock
```

The cashier frontend receives these payment handles from the backend:

- `pay_url`
- `deeplink`
- `qr_code_url`

The invoice is not marked paid when an e-wallet payment is initiated. It is marked paid only after the signed provider webhook is reconciled.

---

## Mock provider

Use `mock` for local development. It needs no external account, sandbox app, or public tunnel unless you want to test through the public webhook route.

### Environment

```bash
APP_ENV=development
PUBLIC_BASE_URL=http://localhost:8080
MOCK_WEBHOOK_SECRET=optional-local-secret
```

If `MOCK_WEBHOOK_SECRET` is empty in non-production, the app falls back to `JWT_SECRET` for local mock webhook signing.

### Seed behavior

The seed command registers the `mock` payment method only when:

```bash
APP_ENV != production
```

### Test flow

1. Start backend and frontend.
2. Run seed if needed.
3. Open cashier UI.
4. Choose **E-wallet** → **Mock Wallet**.
5. Backend creates a `PROCESSING` payment.
6. Click **Mock: mark paid** or **Mock: fail** in the cashier UI.
7. The dev endpoint signs a mock webhook and routes it through the real webhook handler.

Manual API simulation:

```bash
curl -X POST http://localhost:8080/api/v1/billing/payments/mock/complete \
  -H 'Content-Type: application/json' \
  -d '{"payment_number":"PAY-xxx","result":"success"}'
```

Supported `result` values:

- `success`
- `completed`
- `failed`
- `fail`

---

## MoMo sandbox

MoMo provides separate test and production environments. Credentials differ per environment.

Required MoMo credentials:

- Partner Code
- Access Key
- Secret Key

MoMo sandbox domain:

```text
https://test-payment.momo.vn
```

Production domain:

```text
https://payment.momo.vn
```

The app uses MoMo wallet one-time payments with:

```text
POST /v2/gateway/api/create
requestType=captureWallet
```

### Setup steps

1. Register or access a MoMo Business / M4B account.
2. Enable the MoMo e-wallet payment solution.
3. Get sandbox credentials from MoMo Business / MoMo integration portal.
4. Expose the backend over HTTPS if testing real IPN callbacks locally.
5. Configure environment:

```bash
APP_ENV=development
PUBLIC_BASE_URL=https://your-public-api.example.com

MOMO_ENDPOINT=https://test-payment.momo.vn
MOMO_PARTNER_CODE=your_test_partner_code
MOMO_ACCESS_KEY=your_test_access_key
MOMO_SECRET_KEY=your_test_secret_key
```

6. Confirm MoMo can reach this webhook URL:

```text
https://your-public-api.example.com/api/v1/billing/payments/webhook/momo
```

7. Start backend and frontend.
8. In cashier UI, choose **E-wallet** → **MoMo**.
9. Backend initiates a MoMo payment and returns `pay_url`, `deeplink`, and/or `qr_code_url`.
10. Pay with the MoMo test app/account.
11. MoMo sends IPN to the webhook.
12. Backend verifies signature, checks amount, inserts an idempotency record, then marks invoice `PAID` and closes the dining session.

### MoMo verification rules

The backend must:

- Verify MoMo HMAC-SHA256 signature using `MOMO_SECRET_KEY`.
- Match provider amount with stored payment amount.
- Use `orderId` / payment number as fallback lookup.
- Treat `resultCode = 0` as success.
- Treat non-zero `resultCode` as failed.
- Keep webhook handling idempotent via `payment_webhook_events`.

### MoMo operational notes

MoMo docs require a minimum timeout of 30 seconds for API calls. Before production/UAT, set the provider HTTP client timeout to at least 30 seconds.

MoMo production may require explicit permission for these response fields:

- `qrCodeUrl`
- `deeplink`
- `deeplinkMiniApp`

Confirm this with MoMo before go-live.

---

## ZaloPay sandbox

ZaloPay sandbox credentials are provided by ZaloPay after merchant contact/onboarding.

Required ZaloPay credentials:

- App ID
- Key1
- Key2
- Sandbox gateway endpoint

`key1` signs create-order requests.
`key2` verifies callback data.

### Setup steps

1. Contact ZaloPay BD/support for sandbox access.
2. Provide requested phone number and email.
3. Receive sandbox `AppId`, `key1`, `key2`, and endpoint.
4. Expose the backend over HTTPS if testing real callbacks locally.
5. Configure environment:

```bash
APP_ENV=development
PUBLIC_BASE_URL=https://your-public-api.example.com

ZALOPAY_ENDPOINT=https://sandbox-or-qc-zalopay-endpoint
ZALOPAY_APP_ID=your_sandbox_app_id
ZALOPAY_KEY1=your_sandbox_key1
ZALOPAY_KEY2=your_sandbox_key2
```

6. Confirm ZaloPay can reach this callback URL:

```text
https://your-public-api.example.com/api/v1/billing/payments/webhook/zalopay
```

7. Start backend and frontend.
8. In cashier UI, choose **E-wallet** → **ZaloPay**.
9. Backend creates a ZaloPay order and returns `order_url` as `pay_url` / `qr_code_url`.
10. Customer completes payment in the ZaloPay sandbox flow.
11. ZaloPay calls the callback URL.
12. Backend verifies callback `mac`, checks amount, inserts an idempotency record, then marks invoice `PAID` and closes the dining session.

### ZaloPay verification rules

ZaloPay callback body contains:

```json
{
  "data": "{...}",
  "mac": "...",
  "type": 1
}
```

The backend must verify:

```text
mac == HMAC_SHA256(ZALOPAY_KEY2, data)
```

Then it reads:

- `app_trans_id` — merchant transaction reference
- `zp_trans_id` — ZaloPay transaction ID
- `amount` — amount collected in VND

The backend checks `amount` against the stored payment amount before marking the invoice paid.

---

## Production checklist

Before production:

1. Set production mode:

```bash
APP_ENV=production
PUBLIC_BASE_URL=https://api.yourdomain.com
```

2. Replace sandbox credentials with production credentials.

MoMo:

```bash
MOMO_ENDPOINT=https://payment.momo.vn
MOMO_PARTNER_CODE=prod_partner_code
MOMO_ACCESS_KEY=prod_access_key
MOMO_SECRET_KEY=prod_secret_key
```

ZaloPay:

```bash
ZALOPAY_ENDPOINT=prod_zalopay_endpoint
ZALOPAY_APP_ID=prod_app_id
ZALOPAY_KEY1=prod_key1
ZALOPAY_KEY2=prod_key2
```

3. Ensure `JWT_SECRET` is strong and not the dev default.
4. Ensure provider webhook URLs are public HTTPS URLs.
5. Confirm provider IP allowlisting if required.
6. Run provider UAT cases.
7. Confirm payment success, failure, duplicate webhook, and amount mismatch behavior.
8. Confirm outbox/WebSocket cashier updates after `billing.payment_completed`.
9. Confirm dining session closes and table becomes available only after webhook success.
10. Disable mock provider by using `APP_ENV=production`.

---

## Current implementation notes

- Cash/card payments remain synchronous.
- E-wallet payments are asynchronous.
- `process-payment` creates a `PROCESSING` payment for configured e-wallet providers.
- Provider webhooks complete or fail the payment.
- Webhook idempotency uses `payment_webhook_events`.
- Provider amount is never trusted blindly; it must match the stored payment amount.
- No new migrations are required for the current implementation.
