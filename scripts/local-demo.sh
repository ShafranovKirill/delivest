#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
readonly DEMO_DB=delivest_f01_demo_local
readonly SESSION=delivest-local-demo
export MIX_ENV=dev DEV_DATABASE="$DEMO_DB" DEV_EXTERNAL_HOST=127.0.0.1 DEV_DATABASE_PORT=5432
DEMO_SERVER_PORT=${DEMO_SERVER_PORT:-4000}
DEMO_CLIENT_PORT=${DEMO_CLIENT_PORT:-3000}
for port in "$DEMO_SERVER_PORT" "$DEMO_CLIENT_PORT"; do
  [[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1024 && port <= 65535 )) || { echo "Invalid demo port: $port" >&2; exit 1; }
done
export DEFAULT_LOCALE=ru PORT="$DEMO_SERVER_PORT" CLIENT_ORIGIN="http://localhost:$DEMO_CLIENT_PORT"
export VITE_API_BASE_URL="http://localhost:$DEMO_SERVER_PORT"
export DB_USER=postgres DB_PASSWORD=postgres DB_NAME=delivest DB_PORT=5432
export S3_ACCESS_KEY=athena_admin S3_SECRET_KEY=StrongS3Password! S3_BUCKET=delivest S3_PORT=8333

case "${1:-}" in
  prepare)
    if ! docker exec delivest-postgres pg_isready -U postgres >/dev/null 2>&1 || ! curl -sS -o /dev/null --max-time 2 http://127.0.0.1:8333/; then
      docker compose -p delivest-ex -f server/docker-compose.yml up -d --pull missing postgres s3 >/dev/null
    fi
    for attempt in {1..30}; do
      docker exec delivest-postgres pg_isready -U postgres >/dev/null 2>&1 && break
      sleep 1
    done
    docker exec delivest-postgres pg_isready -U postgres >/dev/null 2>&1 || { echo "Postgres did not start" >&2; exit 1; }
    mix_lock=$(sha256sum server/mix.lock | cut -d" " -f1)
    if [[ ! -d server/deps || ! -f server/_build/.local-demo-mix-lock || $(cat server/_build/.local-demo-mix-lock) != "$mix_lock" ]]; then
      (cd server && mix deps.get)
      mkdir -p server/_build
      printf "%s" "$mix_lock" > server/_build/.local-demo-mix-lock
    fi
    (cd server && mix assets.setup)
    if [[ ! -d server/assets/node_modules || ! -f server/assets/node_modules/.local-demo-lock || $(cat server/assets/node_modules/.local-demo-lock) != "$(sha256sum server/assets/package-lock.json | cut -d" " -f1)" ]]; then
      (cd server/assets && npm ci)
      sha256sum server/assets/package-lock.json | cut -d" " -f1 > server/assets/node_modules/.local-demo-lock
    fi
    if [[ ! -d client/node_modules || ! -f client/node_modules/.local-demo-lock || $(cat client/node_modules/.local-demo-lock) != "$(sha256sum client/pnpm-lock.yaml | cut -d" " -f1)" ]]; then
      (cd client && pnpm install --frozen-lockfile)
      sha256sum client/pnpm-lock.yaml | cut -d" " -f1 > client/node_modules/.local-demo-lock
    fi
    (cd server && mix ecto.create && mix ecto.migrate)
    marker=missing
    if [[ $(docker exec delivest-postgres psql -U postgres -d "$DEMO_DB" -Atc "SELECT to_regclass('public.local_demo_setup') IS NOT NULL") == t ]]; then
      marker=$(docker exec delivest-postgres psql -U postgres -d "$DEMO_DB" -Atc "SELECT version FROM local_demo_setup LIMIT 1")
    fi
    if [[ "$marker" == 1 ]]; then
      echo 'Demo data already prepared.'
      exit 0
    fi
    (cd server && mix delivest.storage_setup)
    (cd server && LOCAL_DEMO_PREPARE=1 mix run --no-start scripts/local_f01_demo.exs)
    (cd server && mix run ../examples/demo-menu/apply.exs)
    (cd server && mix run scripts/local_demo_modifiers.exs)
    docker exec delivest-postgres psql -U postgres -d "$DEMO_DB" -v ON_ERROR_STOP=1 -c 'BEGIN; CREATE TABLE local_demo_setup (version integer PRIMARY KEY); INSERT INTO local_demo_setup VALUES (1); COMMIT' >/dev/null
    echo 'Demo data prepared.'
    ;;
  start)
    if tmux has-session -t "$SESSION" 2>/dev/null; then
      running_ports=$(tmux show-environment -t "$SESSION" DEMO_PORTS 2>/dev/null || true)
      if [[ "$running_ports" == "DEMO_PORTS=$DEMO_SERVER_PORT:$DEMO_CLIENT_PORT" ]] && curl -fsS --max-time 2 "http://127.0.0.1:$DEMO_SERVER_PORT/staff/auth/login" >/dev/null && curl -fsS --max-time 2 "http://127.0.0.1:$DEMO_CLIENT_PORT/demo-center" >/dev/null; then
        echo 'Demo already running in tmux session delivest-local-demo.'
        exit 0
      fi
      echo 'Stale demo tmux session; run make demo-stop and retry.' >&2
      exit 1
    fi
    for port in "$DEMO_SERVER_PORT" "$DEMO_CLIENT_PORT"; do
      if (echo >"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
        echo "Port $port is occupied. Stop the current app before starting the new demo." >&2
        exit 1
      fi
    done
    "$0" prepare
    tmux new-session -d -s "$SESSION" -n server -c "$PWD/server" "MIX_ENV=dev DEV_DATABASE=$DEMO_DB DEV_EXTERNAL_HOST=127.0.0.1 DEFAULT_LOCALE=ru PORT=$DEMO_SERVER_PORT CLIENT_ORIGIN=http://localhost:$DEMO_CLIENT_PORT mix run --no-start scripts/local_f01_demo.exs > /tmp/delivest-local-demo-server.log 2>&1"
    tmux set-environment -t "$SESSION" DEMO_PORTS "$DEMO_SERVER_PORT:$DEMO_CLIENT_PORT"
    tmux new-window -t "$SESSION" -n client -c "$PWD/client" "VITE_API_BASE_URL=http://localhost:$DEMO_SERVER_PORT pnpm dev --host 127.0.0.1 --port $DEMO_CLIENT_PORT --strictPort > /tmp/delivest-local-demo-client.log 2>&1"
    for attempt in {1..30}; do
      running_ports=$(tmux show-environment -t "$SESSION" DEMO_PORTS 2>/dev/null || true)
      if [[ "$running_ports" == "DEMO_PORTS=$DEMO_SERVER_PORT:$DEMO_CLIENT_PORT" ]] && curl -fsS --max-time 2 "http://127.0.0.1:$DEMO_SERVER_PORT/staff/auth/login" >/dev/null && curl -fsS --max-time 2 "http://127.0.0.1:$DEMO_CLIENT_PORT/demo-center" >/dev/null; then
        echo "Demo ready: http://localhost:$DEMO_SERVER_PORT/staff/auth/login and http://localhost:$DEMO_CLIENT_PORT/demo-center"
        exit 0
      fi
      sleep 2
    done
    echo 'Demo startup failed; inspect /tmp/delivest-local-demo-{server,client}.log' >&2
    exit 1
    ;;
  stop)
    tmux kill-session -t "$SESSION" 2>/dev/null || true
    ;;
  reset)
    [[ "${DEMO_RESET:-}" == yes ]] || { echo 'Run DEMO_RESET=yes make demo-reset to delete only the dedicated demo database.' >&2; exit 1; }
    "$0" stop
    docker exec delivest-postgres dropdb -U postgres --if-exists --force "$DEMO_DB"
    ;;
  *) echo 'Usage: local-demo.sh prepare|start|stop|reset' >&2; exit 2 ;;
esac
