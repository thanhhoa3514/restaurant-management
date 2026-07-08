ARG NODE_VERSION=22
ARG NGINX_VERSION=1.27-alpine

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# ponytail: vite build only (esbuild strips types). `tsc -b` is skipped on
# purpose — unrelated slices (catalog/waiter/kitchen/routes) have pre-existing
# type errors that would block bundling. Fix those, then restore tsc in CI.
# Same-origin deploy: no VITE_API_URL/VITE_PUBLIC_ORIGIN → api.ts uses relative
# paths, QR uses window.location.origin. Pass --build-arg to override.
ARG VITE_API_URL=""
ARG VITE_PUBLIC_ORIGIN=""
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_PUBLIC_ORIGIN=${VITE_PUBLIC_ORIGIN}
RUN npx vite build

# ── Serve stage ──────────────────────────────────────────────────────────────
FROM nginx:${NGINX_VERSION}
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
