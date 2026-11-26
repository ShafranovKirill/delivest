# Mobile menu performance measurement

## Reproduction

Build each stage from its corresponding client/server revision; keep the toolchain, Chromium, seeded branch, media fixture and network profile identical. Install dependencies and seed the database with the steps in [the E2E workflow](../../../.github/workflows/e2e.yml). Its fixture is `http://localhost:3100/e2e`; start its server and client using the commands in `e2e/playwright.config.ts` (ports 4100 and 3100). Run from repository root:

```sh
node scripts/storefront-measure.mjs --url http://localhost:3100/e2e --passes 5 --output artifacts/menu-performance/before --capture
node scripts/storefront-measure.mjs --url http://localhost:3100/e2e --passes 5 --output artifacts/menu-performance/media-stage --capture
node scripts/storefront-measure.mjs --url http://localhost:3100/e2e --passes 5 --output artifacts/menu-performance/final --capture
```

Run each command against its corresponding checkout/build, with exactly the same fixture and media host. Each run starts five fresh browser contexts, measures a cold navigation and a warm reload in each, waits for the first visible card and then settles 2.5 seconds. The Chromium profile is 390×844, DPR 1, mobile touch, ru-RU, service workers blocked, 10 Mbps download, 2 Mbps upload and 80 ms latency. `--capture` saves screenshots and traces; omit it for a smaller run. Raw output goes to `browser.json` and includes per-request transfer bytes, HTTP status (including 304), cache indicators, WebSocket counts and frame payload sizes, LCP, CLS (excluding recent input), first visible decoded product photograph, and category/card counts. JSON URLs are stored without query strings; errors are counts only. Optional Chromium traces can contain raw request URLs, so capture only the controlled `/e2e` fixture without user data; the CLI rejects an entry URL with query parameters. Photo timing is `null` if no actual visible photo appears in the settle window. Compare medians of five samples per mode and inspect missing values and errors before drawing conclusions. Network conditions do not model CPU throttling. The earlier CLI forms (`--url=`, `--api=`, `--runs=`, `--modes=`, `--settle-ms=`, `--output=path.json`, `--label=`) remain accepted, and the JSON retains its former `summary` and `results` fields alongside the new samples.

For photo-enabled runs, first prepare the isolated fixture database using the **final** additive media migration and `MENU_PERFORMANCE_PHOTO_FIXTURE=1 mix run priv/repo/e2e_seeds.exs` from the final `server`. Snapshot this database and restore an identical copy for each before/media-stage/final run. The old server can read the additive media row, emits the legacy 800 px `photo_url`, and the old client ignores the additional variant metadata; later revisions emit responsive variants. Run the final checkout's measurement script against each stage's server/client. Copy the four deterministic files from `e2e/fixtures/menu-performance` into `server/priv/static/images` for each revision before starting Phoenix, and start Phoenix with `DEV_S3_PORT=4100` so public URLs resolve through Plug.Static at port 4100. The before checkout does not contain the new seed or measurement script. Ordinary E2E seed runs without the opt-in flag retain their existing products. Keep absent photo values missing. The [Lighthouse workflow](../../../.github/workflows/storefront-lhci.yml) runs on matching develop PR paths and manual dispatch, with three reports against the seeded `/e2e` fixture and uploads its output. It is report only: no threshold or assertion. Its LHCI version is explicitly pinned in the workflow, but its dependency tree has no lockfile because the package was unavailable offline when this was authored. Generate and review a lockfile before making this workflow a required gate.

## Targeted UI regression run

Use the same seeded E2E setup and the existing Playwright `webServer` definitions:

```sh
pnpm --dir e2e exec playwright test menu-performance.spec.ts --project=chromium
MENU_CAPTURE=1 pnpm --dir e2e exec playwright test menu-performance.spec.ts --project=chromium
```

The second command enables Playwright video and screenshots in `e2e/test-results`; traces are retained on failure. The spec exercises delayed and failed/retried menu sections, empty bootstrap, long sections and scrolling, category jump, direct product routes, closing while a detail request is pending, a manifest revision and background section update, SPA branch selection and reduced motion. These cases require a browser run to verify the assertions.

## SQL series on an isolated local database

Prepare the final additive schema and fixture once on an isolated database, then restore its snapshot before each stage; older checkouts do not contain the opt-in seed. From `server` (do not aim this at a shared development database):

```sh
DEV_DATABASE=delivest_menu_perf_20261126 mix ecto.create
DEV_DATABASE=delivest_menu_perf_20261126 mix ecto.migrate
DEV_DATABASE=delivest_menu_perf_20261126 MENU_PERFORMANCE_PHOTO_FIXTURE=1 mix run priv/repo/e2e_seeds.exs
DEV_DATABASE=delivest_menu_perf_20261126 STOREFRONT_MEASURE_SLUG=e2e STOREFRONT_MEASURE_ACK=clear-isolated-caches STOREFRONT_MEASURE_OUTPUT=../artifacts/menu-performance/before/sql.json mix run --no-start scripts/storefront_sql_measure.exs
DEV_DATABASE=delivest_menu_perf_20261126 STOREFRONT_MEASURE_SLUG=e2e STOREFRONT_MEASURE_ACK=clear-isolated-caches STOREFRONT_MEASURE_OUTPUT=../artifacts/menu-performance/media-stage/sql.json mix run --no-start scripts/storefront_sql_measure.exs
DEV_DATABASE=delivest_menu_perf_20261126 STOREFRONT_MEASURE_SLUG=e2e STOREFRONT_MEASURE_ACK=clear-isolated-caches STOREFRONT_MEASURE_OUTPUT=../artifacts/menu-performance/final/sql.json mix run --no-start scripts/storefront_sql_measure.exs
```

For the first three setup commands use the final server checkout, snapshot the seeded database, then restore it and run each measurement command with its matching server checkout and build; use an idle database. Create the three output directories first. Cold mode explicitly clears application caches and refuses a nonlocal or nonperf database. The script records three repetitions per endpoint with request time, response bytes and SQL telemetry.

## Checked evidence and pending runs

The client source is at `47891b6123529277361db4f59e4e67bf48062af3`; the final server source is at `ab7edebd5544f05ca2a76ef2448cbae38b7db45f` (the isolated photo seed was committed as `ad203d3eebb37c1e8ee650668f7c908eac9eb77f`). The parent feature branch began from a cached `develop` commit `fa009a2` because GitHub fetch was blocked. The original checkout remains untouched. The client build measurement is recorded in [menu-performance-build.json](../../../client/docs/menu-performance-build.json).

| Offline measure | Before | Final | Scope |
| --- | ---: | ---: | --- |
| Static startup JS+CSS graph, gzip | 312,443 B (33 chunks) | 308,825 B (36 chunks) | −3,618 B (−1.16%); Vite manifest import traversal, **not browser transfer** |
| Four icon sources, file bytes | 1,197,199 B PNG | 9,462 B WebP | −99.21% of these four source files; **not transferred image bytes** |
| Browser first card, LCP, CLS, first photo | Missing | Missing | The final five-pair browser run has not executed |
| SQL runtime series | Missing | Missing | The three isolated series have not executed |

The client `vue-tsc`, 17 Vitest tests in four files and Vite build passed. Server changed-module compilation passed with warnings from stale precompiled modules; its targeted Mix test command stopped before tests because Mix.PubSubTCP was denied by the sandbox. The optional bundle analyzer package was unavailable offline; its mode is prepared but no analyzer report exists. These source and build checks do not establish browser performance.

The original five cold/warm samples from `/demo-center` are copied byte for byte to [browser.json](baseline/browser.json), and the SQL samples to [sql.json](baseline/sql.json). These are a historical, different fixture (port 3000), so do not merge them with `/e2e` medians. Historical summary: cold transfer 3,037,463 B, including 2,667,063 B images and 307,527 B startup scripts; warm transfer 9,848 B, with 318 B image transfer (a 304 SVG) and no downloaded photographs. First card was 1053/397 ms and LCP 1116/428 ms (cold/warm). The old capture has no first-photo or CLS observations. Recalculate values from raw samples when comparing stages.

The targeted Playwright spec has not run here. The required before, media-stage and final five-pair browser runs and three SQL series have **not run** in this environment: Chromium/listen, database and Docker are unavailable here. Their artifact locations above are reserved, not evidence of a measured improvement. The Lighthouse PR/manual workflow has not run either. Keep all generated `artifacts/menu-performance/{before,media-stage,final}` outputs together with the tested SHAs and media fixture metadata when running in a suitable environment.
