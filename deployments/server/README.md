# Server layout — one folder per service

Mirrors `~/containers/` on the VPS. Copy each folder into `~/containers/apps/`,
copy each `.env.example` → `.env` and fill every `CHANGE_ME`.

```
~/containers/
├── apps/
│   ├── postgres/   docker-compose.yml + .env
│   ├── minio/      docker-compose.yml + .env
│   ├── backend/    docker-compose.yml + .env   (image restaurant-api — migrate → seed → api)
│   ├── frontend/   docker-compose.yml + .env   (image restaurant-web — static SPA)
│   └── nginx/      docker-compose.yml + nginx.conf   (edge proxy, port 80)
├── data/           postgres + minio volumes (created automatically)
└── logs/           api + nginx logs
```

All services join the shared external docker network (once per server):

```bash
docker network create restaurant
```

Fixed container names = DNS on that network: `postgres`, `minio`, `api`, `web`, `edge`.

## Deploy flow

**Local — build & pack images:**

```bash
./scripts/build-release.sh prod        # or uat
# → release/restaurant-images-prod-<sha>.tar.gz
```

**Upload** the tarball via Termius (SFTP) to the server, then:

```bash
docker load -i restaurant-images-prod-<sha>.tar.gz

cd ~/containers/apps/postgres && docker compose up -d
cd ~/containers/apps/minio    && docker compose up -d
cd ~/containers/apps/backend  && docker compose up -d   # runs migrate → seed → api
cd ~/containers/apps/frontend && docker compose up -d
cd ~/containers/apps/nginx    && docker compose up -d
```

Postgres/minio only need starting once; for an update only backend/frontend
need `docker load` + `up -d` again (migrate/seed re-run, both idempotent).

After deploying a release that contains bundled menu images, verify that the
web container has the files and serves the correct content type:

```bash
docker exec web test -s /usr/share/nginx/html/images/menu/lau-thai-tomyum.webp
curl -I http://localhost/images/menu/lau-thai-tomyum.webp
# Expected: HTTP 200 and Content-Type: image/webp
```

## Verify

```bash
docker ps
curl -I http://localhost/health        # 200 via edge nginx → api
```

## SePay Test Mode

The backend `.env` must contain the same HMAC secret configured in the SePay
dashboard. Never commit the real secret:

```dotenv
SEPAY_BANK_CODE=Vietcombank
SEPAY_ACCOUNT_NUMBER=0000000001
SEPAY_ACCOUNT_NAME=HO KINH DOANH TEST 3CBA
SEPAY_WEBHOOK_SECRET=<same-secret-as-SePay-dashboard>
SEPAY_QR_BASE_URL=https://vietqr.app/img
SEPAY_DEMO_AMOUNT_VND=0
```

`SEPAY_BANK` is accepted as an alias of `SEPAY_BANK_CODE`, and
`SEPAY_ACCOUNT_HOLDER` is accepted as an alias of `SEPAY_ACCOUNT_NAME`.

Configure the Test Mode payment-code recognizer with prefix `PAY`, minimum and
maximum suffix length `16`, and character type `Số và chữ`. Configure the
incoming JSON webhook at:

```text
https://jackiengo.io.vn/api/v1/billing/payments/webhook/sepay
```

Select HMAC-SHA256 authentication, the test Vietcombank account, and enable
`Chỉ gửi khi có mã thanh toán` with the `PAY` prefix. To test end to end, start a
SePay payment in the cashier UI, then simulate an incoming transaction for the
exact invoice amount with the generated `PAY...` code in its content.

For a controlled end-to-end test against a real linked bank account, setting
`SEPAY_DEMO_AMOUNT_VND=5000` keeps the real invoice total on the cashier and
guest screens but puts `5,000 VND` into the QR. The webhook then expects exactly
`5,000 VND`, records that received amount, and settles the full invoice so the
realtime flow can complete. This deliberately bypasses full-value settlement:
reset it to `0` before accepting real customer payments.

## Notes

- `TAG` in backend/frontend `.env` must match the build env (`prod` or `uat`).
- Edge nginx routes `/api`, `/ws`, `/health` → `api:8080`, everything else → `web:80`.
  The web image itself only serves static files (SPA fallback + asset cache).
- Generated seed/demo images under `/images/menu/` are bundled into the
  frontend image. Admin-uploaded images continue to use MinIO through the edge
  route `/restaurant-images/`; `S3_PUBLIC_URL` must point to that public route.
- Old images pile up after repeated loads: `docker image prune -f`.
