# Restaurant Management

Monorepo đã được tách gọn theo ranh giới rõ ràng:

```text
backend/   Go API scaffold, migrations, OpenAPI, Docker assets
frontend/  Vite/React app, prototype screens, UI assets
docs/      Architecture, agent prompt, design, database schema notes
```

## Quick commands

```bash
make backend-build
make backend-test
make frontend-build
```

## Backend

```bash
cd backend
make build
make test
make migrate
make seed
```

## Frontend

```bash
cd frontend
npm run dev
npm run build
```

## Docs

- `docs/ARCHITECTURE.md`
- `docs/AGENT_PROMPT.md`
- `docs/DESIGN.md`
- `docs/database_schema_lau_nuong_my_cay.md`
