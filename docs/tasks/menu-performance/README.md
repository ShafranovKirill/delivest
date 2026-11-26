# Mobile menu performance measurement

## Reproduction

Build each stage from its corresponding client/server revision; keep the toolchain, Chromium, seeded branch, media fixture and network profile identical. Install dependencies and seed the database with the steps in [the E2E workflow](../../../.github/workflows/e2e.yml). Its fixture is `http://localhost:3100/e2e`; start its server and client using the commands in `e2e/playwright.config.ts` (ports 4100 and 3100). Run from repository root:

```sh
node scripts/storefront-measure.mjs --url http://localhost:3100/e2e --passes 5 --output artifacts/menu-performance/before --capture
node scripts/storefront-measure.mjs --url http://localhost:3100/e2e --passes 5 --output artifacts/menu-performance/media-stage --capture
node scripts/storefront-measure.mjs --url http://localhost:3100/e2e --passes 5 --output artifacts/menu-performance/final --capture
```

Run each command against its corresponding checkout/build, with exactly the same fixture and media host. Each run starts five fresh browser contexts, measures a cold navigation and a warm reload in each, waits for the first visible card and then settles 2.5 seconds. The Chromium profile is 390×844, DPR 1, mobile touch, ru-RU, service workers blocked, 10 Mbps download, 2 Mbps upload and 80 ms latency. `--capture` saves screenshots and traces; omit it for a smaller run. Raw output goes to `browser.json` and includes per-request transfer bytes, HTTP status (including 304), cache indicators, WebSocket counts and frame payload sizes, LCP, CLS (excluding recent input), first visible decoded product photograph, and category/card counts. JSON URLs are stored without query strings; errors are counts only. Optional Chromium traces can contain raw request URLs, so capture only the controlled `/e2e` fixture without user data; the CLI rejects an entry URL with query parameters. Photo timing is `null` if no actual visible photo appears in the settle window. Compare medians of five samples per mode and inspect missing values and errors before drawing conclusions. Network conditions do not model CPU throttling. The earlier CLI forms (`--url=`, `--api=`, `--runs=`, `--modes=`, `--settle-ms=`, `--output=path.json`, `--label=`) remain accepted, and the JSON retains its former `summary` and `results` fields alongside the new samples.

For photo-enabled runs, first prepare the isolated fixture database using the **final** additive media migration and `MENU_PERFORMANCE_PHOTO_FIXTURE=1 mix run priv/repo/e2e_seeds.exs` from the final `server`. Snapshot this database and restore an identical copy for each before/media-stage/final run. The old server can read the additive media row, emits the legacy 800 px `photo_url`, and the old client ignores the additional variant metadata; later revisions emit responsive variants. Run the final checkout's measurement script against each stage's server/client. Copy the four deterministic files from `e2e/fixtures/menu-performance` into `server/priv/static/images` for each revision before starting Phoenix, and start Phoenix with `DEV_S3_PORT=4100` so public URLs resolve through Plug.Static at port 4100. The before checkout does not contain the new seed or measurement script. Ordinary E2E seed runs without the opt-in flag retain their existing products. Keep absent photo values missing. The [Lighthouse workflow](../../../.github/workflows/storefront-lhci.yml) runs on matching develop PR paths and manual dispatch, with three reports against the seeded `/e2e` fixture and uploads its output. It is report only: initial thresholds warn, with no blocking performance gate. The LHCI version and dependency tree are pinned in `tools/lighthouse/package-lock.json`; assertions initially warn until CI reproducibility is established.

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

## Verified local results — 26 November 2026

See [RESULTS.md](RESULTS.md) and [raw summaries](results/summary.json) for the completed
five-pair before/media/final browser series, three cold/warm SQL repetitions,
first modal click, quality comparisons, screenshots and targeted checks.
The local fixture is the original `/demo-center` snapshot copied into
`delivest_menu_perf_20261126`; it matches the original 5 categories, 31 cards,
6 stories and real photographs. The `/e2e` fixture remains separate for UI and LHCI.

The pinned toolchain, PostgreSQL, S3, Chromium and containerized production Nginx
are available on this device. Earlier offline limitations do not apply to these
completed measurements. Source fixes discovered by runtime checks are included
in the final client/server commits recorded in the results metadata.

The optional visualizer and LHCI tool now have committed lockfiles. Install with
`npm ci --prefix client/tools/bundle-analysis` and `npm ci --prefix tools/lighthouse`.
The Lighthouse workflow uploads both the HTML bundle report and Lighthouse results;
all initial thresholds in `tools/lighthouse/lighthouserc.cjs` are warnings. CI itself
has not run for the new local commits: push/PR/merge require the owner's separate
command. No full preflight or full E2E was run.
