# S5 exploratory load protocol

This protocol exercises the local Phoenix HTTP API against an isolated PostgreSQL database. It measures a safe guest, pickup, cash subset of N01–N03. It does not certify capacity.

## Safety and fixture

- Use `MIX_ENV=dev`, `DEV_DATABASE=delivest_s5_load*`, and `PORT=4200`. Both seed and server scripts reject other database names. The runner needs `--run`, checks the listener PID and its database environment, confirms the checkout path, and verifies all five fixture branch IDs in that database. The runner only accepts HTTP loopback port 4200. Never run it against a live or shared environment.
- `seed.exs` refuses a nonempty branch table. It creates five active branches, ten categories and 200 products per branch, 20 products per branch with a two-choice modifier group, plus three automatic promotions per branch: pickup-applicable, delivery-only, and high-subtotal. It writes branch and product IDs to a JSON fixture.
- No branch has provider credentials. The measured order uses guest identity, pickup, and cash. No live payment, CRM, SMS, push, fiscal, or delivery API is called. Rate limits are per client IP; the runner gives each virtual session a stable address from benchmark range `198.18.0.0/15` through the trusted loopback proxy header. This simulates client identity, not network performance.

## Local commands

Run from repository root unless noted. Choose a fresh database suffix and do not reset another database.

```sh
cd server
MIX_ENV=dev DEV_DATABASE=delivest_s5_load_example mix ecto.create
MIX_ENV=dev DEV_DATABASE=delivest_s5_load_example mix ecto.migrate
MIX_ENV=dev DEV_DATABASE=delivest_s5_load_example S5_FIXTURE_FILE=/tmp/delivest-s5-load-fixture.json mix run ../scripts/load/seed.exs
MIX_ENV=dev DEV_DATABASE=delivest_s5_load_example PORT=4200 PHX_SERVER=true S5_TELEMETRY_FILE=/tmp/delivest-s5-load-telemetry.json mix run --no-start ../scripts/load/server.exs
```

In another shell, from repository root:

```sh
MIX_ENV=dev DEV_DATABASE=delivest_s5_load_example node scripts/load/run.mjs --run --fixture /tmp/delivest-s5-load-fixture.json --sessions 1 --seconds 5 --think-ms 1000 --output /tmp/delivest-s5-load-smoke.json
MIX_ENV=dev DEV_DATABASE=delivest_s5_load_example node scripts/load/run.mjs --run --fixture /tmp/delivest-s5-load-fixture.json --sessions 100 --seconds 120 --think-ms 10000 --output /tmp/delivest-s5-load-100.json
node --test scripts/load/*.test.mjs
```

The smoke command exits 2 because it has too few samples for the load gate. Confirm its menu, cart, and order responses all succeeded before the 100-session run. Use the same frozen 120-second duration, 10-second think time, 50/min paced order schedule and accepted thresholds. Check gate and individual action counts in JSON. Escalate to 500, then 1000 sessions only if the preceding step passes. Never treat 429 as a harmless business decline.

The gate requires at least 100 measured requests, ten successful samples per action, no unexpected 4xx, no 429, technical errors below 0.1%, p95 menu ≤200 ms, cart ≤300 ms, order save ≤500 ms, and orders close to the scheduled 50/min target. It separates 5xx/timeouts from 4xx. It is a stop signal for this short exploration, not stable-stage acceptance.

## Evidence and open coverage

Save the fixture, report, server log, SQL telemetry JSON, SHA, Node/Elixir/PostgreSQL versions, CPU/RAM/disk, DB pool size, Oban queue concurrency, and cache state. `server.exs` reduces debug logging and records cumulative SQL count, total time, and queue time. A short run cannot establish lock waits, pool saturation, backlog recovery, GC, or resource stability. Record any unmeasured metric explicitly.

Account, delivery, bonuses, online payment, socket sessions, provider delay/fault injection, cold-cache spike, and N04 fault/recovery are outside this first subset. Full N02 still needs 5-minute warmup, 30-minute stable stages, 5-minute spike, at least 2-hour soak, and three repeat profiles on the same environment and configuration. No capacity claim or pilot approval follows from a two-minute exploratory profile.
