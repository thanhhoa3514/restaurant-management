.PHONY: build run migrate seed lint test vet tidy

build:
	go build ./...

run:
	go run ./cmd/api

migrate:
	go run github.com/pressly/goose/v3/cmd/goose@latest -dir migrations postgres "$${DATABASE_URL}" up

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
