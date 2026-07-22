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

## Verify

```bash
docker ps
curl -I http://localhost/health        # 200 via edge nginx → api
```

## Notes

- `TAG` in backend/frontend `.env` must match the build env (`prod` or `uat`).
- Edge nginx routes `/api`, `/ws`, `/health` → `api:8080`, everything else → `web:80`.
  The web image itself only serves static files (SPA fallback + asset cache).
- MinIO stays internal; menu images aren't publicly reachable until you add an
  nginx `location /images/ { proxy_pass http://minio:9000/; }` and point
  `S3_PUBLIC_URL` at it.
- Old images pile up after repeated loads: `docker image prune -f`.
