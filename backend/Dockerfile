ARG GO_VERSION=1.26
ARG ALPINE_VERSION=3.22

FROM golang:${GO_VERSION}-alpine AS compiler
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /bin/restaurant-api ./cmd/api \
    && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /bin/restaurant-migrate ./cmd/migrate

FROM alpine:${ALPINE_VERSION}
RUN apk add --no-cache ca-certificates \
    && adduser -D -u 10001 appuser
COPY --from=compiler /bin/restaurant-api /bin/restaurant-api
COPY --from=compiler /bin/restaurant-migrate /bin/restaurant-migrate
USER appuser
# Documentation only — actual listen address comes from HTTP_ADDR.
EXPOSE 8080
ENTRYPOINT ["/bin/restaurant-api"]
