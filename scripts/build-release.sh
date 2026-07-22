#!/usr/bin/env bash
# Build FE + BE docker images, save as tarball: ./scripts/build-release.sh uat|prod
# Output: release/restaurant-images-<env>-<git-sha>.tar.gz
# Upload via Termius → on server: docker load -i <file> → cd apps/<svc> && docker compose up -d
set -euo pipefail

ENV="${1:-}"
[[ "$ENV" == "uat" || "$ENV" == "prod" ]] || { echo "usage: $0 uat|prod" >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHA="$(git -C "$ROOT" rev-parse --short HEAD)"

VITE_API_URL="" VITE_PUBLIC_ORIGIN=""
[[ -f "$ROOT/frontend/.env.$ENV" ]] && source "$ROOT/frontend/.env.$ENV"

echo "==> backend image restaurant-api:$ENV"
docker build -t "restaurant-api:$ENV" -t "restaurant-api:$ENV-$SHA" "$ROOT/backend"

echo "==> frontend image restaurant-web:$ENV"
docker build -t "restaurant-web:$ENV" -t "restaurant-web:$ENV-$SHA" \
  --build-arg VITE_API_URL="$VITE_API_URL" \
  --build-arg VITE_PUBLIC_ORIGIN="$VITE_PUBLIC_ORIGIN" \
  "$ROOT/frontend"

mkdir -p "$ROOT/release"
OUT="$ROOT/release/restaurant-images-$ENV-$SHA.tar.gz"
docker save "restaurant-api:$ENV" "restaurant-web:$ENV" | gzip > "$OUT"
echo "==> $OUT ($(du -h "$OUT" | cut -f1))"
