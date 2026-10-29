SHELL := /bin/bash

export DB_USER := postgres
export DB_PASSWORD := postgres
export DB_NAME := delivest
export DB_PORT := 5432
export S3_ACCESS_KEY := athena_admin
export S3_SECRET_KEY := StrongS3Password!
export S3_BUCKET := delivest
export S3_PORT := 8333
export COMPOSE_IGNORE_ORPHANS := 1

SESSION := delivest
COMPOSE := docker compose -p delivest-ex -f server/docker-compose.yml

.PHONY: dev stop infra infra-down setup server client roles admin branch menu stocks seed db-reset test e2e-db e2e yandex-contract check schema pull logs

dev: infra
	@tmux has-session -t $(SESSION) 2>/dev/null || \
		tmux new-session -d -s $(SESSION) -n dev -c $(CURDIR)/server 'iex -S mix phx.server; exec $$SHELL' \; \
			split-window -h -c $(CURDIR)/client 'pnpm dev --strictPort; exec $$SHELL'
	@if [ -n "$$TMUX" ]; then tmux switch-client -t $(SESSION); else tmux attach -t $(SESSION); fi

stop:
	-tmux kill-session -t $(SESSION)

infra:
	@$(COMPOSE) up -d --no-build postgres s3 2> >(grep -v 'No services to build' >&2)
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

yandex-contract: infra
	cd server && mix test --only yandex_contract

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
