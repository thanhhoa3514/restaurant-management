.PHONY: build run migrate seed lint test vet tidy db-up dev compose-up compose-migrate

COMPOSE_FILE := docker-compose.yml
# Match docker-compose.yml default host port (5440).
DATABASE_URL ?= postgres://postgres:postgres@localhost:5440/restaurant?sslmode=disable
export DATABASE_URL

build:
	go build ./...

db-up:
	docker compose -f $(COMPOSE_FILE) up -d postgres minio

migrate:
	go run ./cmd/migrate

compose-migrate:
	docker compose -f $(COMPOSE_FILE) run --rm migrate

compose-up:
	docker compose -f $(COMPOSE_FILE) up -d --build

dev: db-up
	@echo "Waiting for postgres..."
	@until docker compose -f $(COMPOSE_FILE) exec -T postgres pg_isready -U postgres -d restaurant >/dev/null 2>&1; do sleep 1; done
	$(MAKE) run

run: migrate
	go run ./cmd/api

seed:
	go run ./cmd/seed

lint:
	go vet ./...

test:
	go test ./...

vet:
	go vet ./...

tidy:
	go mod tidy
