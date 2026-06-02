.PHONY: backend-build backend-test backend-vet backend-run backend-migrate frontend-dev frontend-build frontend-lint verify

backend-build:
	$(MAKE) -C backend build

backend-test:
	$(MAKE) -C backend test

backend-vet:
	$(MAKE) -C backend vet

backend-run:
	$(MAKE) -C backend run

backend-migrate:
	$(MAKE) -C backend migrate

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

frontend-lint:
	cd frontend && npm run lint

verify: backend-build backend-vet backend-test frontend-build
