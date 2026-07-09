ARG NODE_VERSION=22
ARG NGINX_VERSION=1.27-alpine

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG VITE_API_URL=""
ARG VITE_PUBLIC_ORIGIN=""
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_PUBLIC_ORIGIN=${VITE_PUBLIC_ORIGIN}
RUN npx vite build


FROM nginx:${NGINX_VERSION}
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
