SHELL := /bin/bash

export DB_USER := postgres
export DB_PASSWORD := postgres
export DB_NAME := delivest
export DB_PORT := 5432
PREFLIGHT_DATABASE ?= delivest_e2e_preflight_$(shell date +%Y%m%d%H%M%S)
PREFLIGHT_DATABASE := $(PREFLIGHT_DATABASE)
export S3_ACCESS_KEY := athena_admin
export S3_SECRET_KEY := StrongS3Password!
export S3_BUCKET := delivest
export S3_PRIVATE_BUCKET ?= delivest-private
export S3_PORT := 8333
export COMPOSE_IGNORE_ORPHANS := 1

SESSION := delivest
COMPOSE := docker compose -p delivest-ex -f server/docker-compose.yml

.PHONY: dev stop infra infra-down setup server client roles admin branch menu stocks demo-menu seed db-reset test e2e-db e2e preflight install-pre-push contract check schema pull logs

dev: infra
	@tmux has-session -t $(SESSION) 2>/dev/null || \
		tmux new-session -d -s $(SESSION) -n dev -c $(CURDIR)/server 'iex -S mix phx.server; exec $$SHELL' \; \
			split-window -h -c $(CURDIR)/client 'pnpm dev --strictPort; exec $$SHELL'
	@if [ -n "$$TMUX" ]; then tmux switch-client -t $(SESSION); else tmux attach -t $(SESSION); fi

stop:
	-tmux kill-session -t $(SESSION)

infra:
	@$(COMPOSE) up -d --build postgres s3 agent 2> >(grep -v 'No services to build' >&2)
	@until docker exec delivest-postgres pg_isready -U $(DB_USER) >/dev/null 2>&1; do sleep 1; done

infra-down:
	$(COMPOSE) stop

setup: infra
	cd server && mix deps.get && mix ecto.create && mix ecto.migrate && mix assets.setup
	cd server && mix delivest.storage_setup && mix delivest.seed_roles && mix delivest.create_admin
	cd server/assets && npm install
	cd client && pnpm install

server: infra
	cd server && iex -S mix phx.server

client:
	cd client && pnpm dev --strictPort

roles: infra
	cd server && mix delivest.seed_roles

admin: infra
	cd server && mix delivest.create_admin

branch: infra
	cd server && mix delivest.seed_branch

demo-menu:
	cd server && MIX_ENV=dev mix run ../examples/demo-menu/apply.exs

menu: infra
	cd server && mix delivest.seed_catalog

stocks: infra
	cd server && mix delivest.seed_stocks

seed: infra
	cd server && mix ecto.migrate && mix delivest.storage_setup && mix delivest.seed_roles && mix delivest.create_admin
	cd server && mix delivest.seed_branch && mix delivest.seed_catalog && mix delivest.seed_stocks

db-reset: infra
	cd server && mix ecto.reset
	$(MAKE) seed

test: infra
	cd server && mix test

e2e-db: infra
	cd server && export DEV_DATABASE=delivest_e2e && mix ecto.drop --force-drop && mix ecto.create && mix ecto.migrate && mix run priv/repo/e2e_seeds.exs

e2e: e2e-db
	cd e2e && pnpm install && pnpm exec playwright install chromium && pnpm test

preflight: export DEV_DATABASE = $(PREFLIGHT_DATABASE)
preflight:
	@case "$$DEV_DATABASE" in delivest_e2e*) ;; *) echo "PREFLIGHT_DATABASE must name a separate delivest_e2e database" >&2; exit 1;; esac
	@echo "Preflight database: $$DEV_DATABASE"
	cd server && mix ecto.create && mix ecto.migrate && mix run priv/repo/e2e_seeds.exs
	cd client && CI=1 pnpm install --frozen-lockfile && pnpm type-check
	cd e2e && CI=1 pnpm install --frozen-lockfile && pnpm typecheck && pnpm exec playwright install chromium
	cd e2e && CI=1 pnpm exec playwright test --retries=0 $(PLAYWRIGHT_ARGS)

install-pre-push:
	@hook="$$(git rev-parse --git-path hooks/pre-push)"; \
	if [ -e "$$hook" ] || [ -L "$$hook" ]; then echo "Existing pre-push hook: $$hook (left unchanged)" >&2; exit 1; fi; \
	mkdir -p "$$(dirname "$$hook")"; \
	printf '#!/bin/sh\nset -eu\nmake preflight\n' > "$$hook" && chmod +x "$$hook"

contract: infra
	@test -n "$(P)" || (echo "usage: make contract P=<provider>" && exit 1)
	cd server && set -a && { [ ! -f .env.contract ] || . ./.env.contract; } && set +a && mix test --only $(P)_contract

check: infra
	cd server && mix compile --warnings-as-errors && mix format --check-formatted && mix test
	cd client && pnpm type-check && pnpm lint

schema:
	cd client && pnpm schema:sync

pull:
	git pull --ff-only
	git submodule foreach 'git pull --ff-only'

logs:
	$(COMPOSE) logs -f --tail 50
