# Storefront startup measurements

Work in progress, 19 November 2026 (Europe/Moscow). This file records actual
measurements; target budgets are not measured results.

## Method

Baseline parent `59c4d8927ec1970e7e87a8dff8b50cdec3b649d8`, server
`df1b349b889944848f110708fef53f63a768f028`, client
`097a28b9cd39fa97043e077221ed87b8c1ca8dc1` (fresh `origin/develop`).
The baseline server runs in a pinned detached worktree; the baseline client's
production build is preserved separately while implementation continues.

Local demo database `delivest_f01_demo_local`: 3 active branches, `demo-center`
with 5 categories and 30 distinct products. Guest, no pre-existing cart on first
navigation. Seven independent browser contexts, each followed by a reload in
the same context. Server caches warmed by preceding measurements. No production
requests or real purchases are performed.

Chromium mobile viewport 390×844, fixed CDP network conditions: 10 Mbit/s down,
2 Mbit/s up, latency parameter 80 ms. This is a comparison profile, not an
estimate of the user's connection or a population average. CPU is not throttled.
CDP throttles each browser connection, not all server-side external calls.

Time to menu is navigation start to the first visible real product card under
a category. A further 2.5 seconds captures startup API completion, separately
from time to menu. Service workers are blocked consistently. Response transfer
bytes come from CDP `encodedDataLength` (including response protocol overhead),
not JSON character counts. API requests exclude OPTIONS and socket handshakes;
the full request list is saved separately in the JSON. The backend uses the
development build with per-request compilation disabled by
`scripts/storefront-measure-server.exs`, consistently before and after. This
removes development-only migration introspection from the timing comparison;
it remains a local benchmark, not a deployed production measurement.

Run from the parent repository with a production preview on port 3000 and API
on port 4000 (the backend CORS origin must match):

```sh
node scripts/storefront-measure.mjs --runs=7 --label=before --output=docs/tasks/storefront-performance/before.json
```

## Baseline

| Scenario | Samples | Median menu visible | p95 (nearest rank) | API requests | API response transfer |
| --- | ---: | ---: | ---: | ---: | ---: |
| Fresh browser, warmed server | 7 | 1171 ms | 1615 ms | 9 every run | 10117–10121 bytes |
| Reload, same browser | 7 | 1056 ms | 1071 ms | 9 every run | 9968–9971 bytes |

With seven samples the reported p95 is the maximum observed value. It is not a
reliable production tail-latency estimate. `before.json` is the final baseline
using the reproducible runner above and should be used for the paired comparison.

The nine API calls all completed with HTTP 200: franchise, branch list, branch
selection, advertising config, socket token, menu, stories, active orders, cart.

Same-cookie warm handler application SQL, measured using Ecto telemetry:
franchise 5, branches 11, select 5, menu 6, stories 0, advertising 7, cart 3,
active orders 1, socket token 0; total **38**. Development's
`CREATE TABLE IF NOT EXISTS schema_migrations` is excluded explicitly by query
text, not merely telemetry `source` (which is nil for that query). Otherwise it
would add one to every handler and incorrectly report 47.

## After implementation

Matched measurements completed on 19 November 2026; aggregate data and exact
source commits are in `paired-summary.json`. The historical baseline above is
retained separately. This comparison rebuilds both clients and uses database
clones with the same 3 branches, 30 menu products, 5 categories, 6 banners and
36 photos in isolated local MinIO. Current schema53; identical runtime config.

| Metric | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| First product visible, fresh browser, median | 1.187 s | 0.978 s | 0.210 s / 17.6% |
| Same-browser reload, median | 1.074 s | 0.821 s | 0.254 s / 23.6% |
| Startup API calls | 9 | 2 | 77.8% |
| Startup API response transfer, fresh browser | 9535 bytes | 5476 bytes | 42.6% |
| BEAM CPU per 100 warm API scenarios, median | 6.30 CPU-s | 1.65 CPU-s | 73.8% |
| Elapsed time of 100 warm API scenarios, median | 1.562 s | 0.396 s | 74.6% |
| Idle API calls over 61 seconds | 3 | 0 | 3 config polls removed |

Browser order: before-a, after-a, after-b, before-b; seven fresh contexts per
block, each followed by reload: 14 samples per revision/mode. Backend restart
and one excluded warmup per block. Same mobile viewport, network and 2500ms
post-menu capture window as above; no full-image-completion or interaction
latency claim. Accepted captures have zero API, page or other HTTP errors.
Raw traces: `paired-{before,after}-{a,b}.json`.

API replay is separate: five visitors, 100 warm scenarios, no network throttling;
two successful before samples and three after (`paired-*-load-*.json`). An
initial third consecutive before batch reached HTTP429 and was excluded; rate
limiting was not disabled. Further measurement stopped at the user's request.
CPU includes BEAM background work, not PostgreSQL/browser/S3. Idle BEAM CPU was
0.58 / 0.53 CPU-s in single 61-second observations; this does not establish an
idle CPU improvement. Shared revision polling and sockets remain active.

**Observed follow-up:** current reload requests 36 images vs 15 initially;
21 new URLs transfer another 2,497,548 bytes. Previously fetched photos transfer
zero bytes, so this is not evidence of broken image cache. The cause of extra
fetches is unconfirmed (hydration/native lazy-load is a hypothesis). Fresh-page
transfer remains about 3.04 MB; reload capture rises from about 16.7 KB to
2.51 MB. API savings must not be reported as equivalent whole-page savings.

Run `scripts/storefront-benchmark-server.exs` from the intended server worktree:
allowlisted startup DBs on loopback55439, endpoint4000, four BEAM schedulers,
warning logging, reload/watchers off, Oban manual. `scripts/storefront-idle.mjs`
records idle requests and optional BEAM CPU/RSS. Dedicated containers
`delivest-cart-completion-pg-20261119` and
`delivest-storefront-benchmark-s3-20261119` are stopped, data preserved. Baseline
ran in detached worktrees; main client/backend sources remain current.
Full preflight/E2E and push were not run.

Cart continuation has a separate final-source SQL comparison in
`cart-completion-before.json` and `cart-completion-after.json`; its method,
transaction overhead and checkout epoch-fence cost are documented in
[CART_README.md](CART_README.md). Cart SQL and the completed browser/CPU
comparison above are separate measurement series.

## Image reload follow-up — 19 November 2026

The extra-image follow-up above is fixed locally. The existing `loading="lazy"`
hint did not prevent distant images from being requested on reload when the
bootstrap populated the menu before Vue mounted. Reproduction showed 15 photo
URLs on initial navigation and 36 on reload, with scrollY remaining zero and
some requested images over 2500 px below the viewport. A static DOM/CSS control
did not reproduce the increase; the browser's internal cause is not established.

Product images and story thumbnails now receive their source only within an
IntersectionObserver margin of 1250 px. Already exposed sources remain available
when scrolling away; a replacement source waits if the element is distant.
Browsers without IntersectionObserver use the original eager source assignment.
Native lazy loading remains an additional hint.

Two independent reviewer runs with the original measurement runner produced
15 photo URLs on both initial navigation and reload, **zero new photo URLs and
zero transferred photo bytes on reload**, versus the previous 21 new URLs and
2,497,548 bytes. Both startup API requests remain present. Compact evidence is
in `reload-images-summary.json`; these small runs do not establish a new latency
or CPU result. An initial reviewer run with a missing preview `env-config.js`
was excluded; the accepted runs have no HTTP or page errors.

Run the targeted browser regression against the isolated fixture and built
preview (ensure `env-config.js` exists after building):

```sh
node scripts/storefront-image-regression.mjs http://localhost:3000/demo-center
```

It checks reload, distant photos, scrolling, product and story viewers, and the
fallback without IntersectionObserver. Client build/type checking and targeted
ESLint passed; build warns about existing large chunks and ESLint reports a
missing `.oxlintrc.json`. Full preflight/E2E and integration remain pending.

## Section ETag follow-up — 19 November 2026

Public section resources are available at
`GET /client/storefront/v1/sections/{franchise|branches|menu|stories|advertising}`.
Menu, stories and advertising require `branch_id`; menu also accepts `locale`.
They load the existing section projections directly. Branch lists retain full
public details required when refreshing the active branch.

Responses contain `data`, `revision` and `valid_until`. A weak ETag identifies
schema version, section, branch, menu locale and revision. `If-None-Match`
accepts matching weak/strong validators, lists and `*`; a match returns an empty
304 with ETag and `X-Storefront-Valid-Until`. The lease can change while the data
identity stays the same. Cache-Control is `public, no-cache, must-revalidate`;
errors are `no-store`. Active-branch, revision and temporal-boundary checks run
before accepting a validator. Bootstrap, manifest and private session contracts
remain unchanged.

Client refreshes use conditional public requests with omitted credentials and
an in-memory cache limited to 32 entries. Branch/locale keys, cancellation and
request generations fence stale responses. Unexpected 304 without local data
gets one unconditional retry, then fails. Menu and advertising validity stays
within the server-confirmed lease, including after 304. Disabling storefront
bootstrap retains legacy services. No persistent section cache is introduced;
the first section refresh after bootstrap can still return 200. This change
therefore does not claim fewer startup requests or measured CPU/latency savings.

Validation: scoped server `mix precommit` passed (26 tests, compile with
warnings-as-errors, inventory check and strict Credo); the primary agent repeated
both test files with 26 passing tests. The primary agent also repeated six client
files with 31 passing tests and completed `pnpm build` (including type checking).
Targeted ESLint and diff checks passed. Existing test Sandbox ownership and build
chunk-size warnings remain. No full preflight/E2E, push, merge or PR was run.

Reproduce server checks in the isolated test partition on loopback55439:

```sh
cd server
ERL_FLAGS='+S 4:4' TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=55439 MIX_TEST_PARTITION=etag20261119 mix precommit test/delivest_web/controllers/client/storefront_sections_test.exs test/delivest_web/controllers/client/storefront_bootstrap_test.exs
```

Client checks:

```sh
cd client
pnpm exec vitest run tests/storefront-sections.test.ts tests/storefront-bootstrap.test.ts tests/storefront-branch-race.test.ts tests/storefront-private-seed.test.ts tests/menu-locale.test.ts tests/metrika-store.test.ts
pnpm build
```

Multi-node temporal-phase determinism, complete batched public Yandex config,
independent rollout flags and hidden-tab SDK verification remain separate work.

## Limits

Local demo data is a small catalog. These numbers do not establish performance
for the largest production menu, many nodes, or 100 simultaneous visitors.
Browser timing is distinct from handler SQL and background revision checks.
The final report must state background database cost separately from warm
handler savings and must not equate HTTP reduction with CPU reduction.
