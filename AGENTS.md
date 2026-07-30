# Repository Guidelines

## Project Structure & Module Organization

This monorepo contains a Go API and a React client:

- `backend/cmd/`: API, migration, setup, and seed entry points.
- `backend/internal/modules/`: bounded contexts (`billing`, `catalog`, `dining`, `identity`, and `ordering`), each organized into domain, application, infrastructure, and HTTP interface layers.
- `backend/internal/platform/`: shared infrastructure such as auth, configuration, PostgreSQL, realtime, and storage.
- `backend/migrations/` and `backend/api/`: SQL migrations and the OpenAPI contract.
- `frontend/src/`: routes, feature API modules, reusable components, contexts, hooks, and utilities.
- `frontend/public/`: static assets; `docs/`: architecture, product, and workflow documentation.
- `deployments/`: Docker Compose and server configuration.

Keep business rules in backend domain/application packages and avoid framework dependencies in domain code. Do not edit generated `frontend/src/routeTree.gen.ts`.

## Build, Test, and Development Commands

Run commands from the repository root:

- `make backend-run`: migrate the configured database and start the Go API.
- `make frontend-dev`: start the Vite development server.
- `make backend-test`: run all Go tests.
- `make frontend-lint`: run ESLint on the frontend.
- `make frontend-build`: type-check and build the production client.
- `make verify`: build, vet, and test the backend, then build the frontend.

For local services, use `make -C backend db-up`. Copy `backend/.env.example` to `backend/.env` and keep secrets out of version control.

## Coding Style & Naming Conventions

Format Go with `gofmt`; use idiomatic lowercase package names, exported `PascalCase` identifiers, and focused files named by use case. Frontend code uses TypeScript/TSX, two-space indentation, single quotes, no semicolons, and a 100-column limit. Run `npm run format:check` or `npm run format` from `frontend/`. Components use `PascalCase`; hooks use `use-*`; route and utility files generally use lowercase or kebab-case names. Preserve snake_case API fields.

## Testing Guidelines

Backend tests use Go’s `testing` package with Testify and live beside source as `*_test.go`. Name cases `TestFunction_Scenario` where practical and cover domain rules, authorization, tenant scoping, HTTP envelopes, and failure paths. Run `go test ./...` from `backend/`. No frontend test framework or coverage threshold is currently configured; at minimum, lint and build UI changes.

## Commit & Pull Request Guidelines

History favors Conventional Commit types such as `feat`, `fix`, and scoped forms like `feat(frontend/catalog): ...`. Write an imperative, specific subject rather than a bare type. Pull requests should summarize behavior, list verification commands, link relevant issues, call out migrations or configuration changes, and include screenshots for visible UI updates.
