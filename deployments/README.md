# Deploy — jackiengo.io.vn (EC2 + Cloudflare)

Single VPS runs the whole stack in Docker. Cloudflare (proxy ON) terminates TLS
and forwards to nginx on port 80.

```
Cloudflare (TLS) ──80──▶ web/nginx ──▶ /api,/ws → api:8080
                                    └▶ /*        → FE static (SPA)
                          api ──▶ postgres, minio  (internal only)
```

## 1. DNS (Cloudflare)

| Type | Name | Value            | Proxy |
|------|------|------------------|-------|
| A    | `@`  | `13.212.56.218`  | ON    |
| A    | `www`| `13.212.56.218`  | ON    |

SSL/TLS mode: **Flexible** (Cloudflare↔origin over HTTP:80).
Upgrade to **Full** later with a Cloudflare Origin Certificate for end-to-end TLS.

## 2. AWS Security Group

Open inbound **80** (and 443 if you move to Full). SSH 22 from your IP only.

## 3. On the VPS

```bash
# Docker + compose plugin
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER   # re-login after

git clone <repo> && cd restaurant-management/deployments
cp .env.prod.example .env
# edit .env — set every CHANGE_ME (DB, MinIO, JWT_SECRET, staff password)

docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Boot order is automatic: postgres healthy → migrate → seed → api → web.

## 4. Verify

```bash
docker compose -f docker-compose.prod.yml ps
curl -I http://localhost/health              # → 200 via nginx
```

Then `https://jackiengo.io.vn` → open, `https://jackiengo.io.vn/order` → QR flow.
Staff login: manager account from seed, password = `DEMO_SEED_PASSWORD`.

## Notes / ceilings

- **Menu images**: MinIO stays internal, so image URLs won't load from the public
  internet yet. The QR-order flow works without them. To fix: add an nginx
  `location /images/ { proxy_pass http://minio:9000/; }` block + a Cloudflare
  DNS record, and point `S3_PUBLIC_URL` at it.
- **`tsc` skipped** in the FE image (pre-existing type errors in catalog/waiter/
  kitchen/routes). Bundling is fine (vite/esbuild). Fix the types, then restore
  `tsc -b` for CI.
- **Update deploy**: `git pull && docker compose -f docker-compose.prod.yml --env-file .env up -d --build`.
  `migrate`/`seed` re-run each up; both are idempotent.
