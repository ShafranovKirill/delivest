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

Final paired measurement is pending. A candidate browser smoke check observed exactly two successful startup GETs (public and private), but it predates subsequent cart changes. Do not treat it as final timing acceptance. Cart progress and the current stop point are in [CART_README.md](CART_README.md).

Cart continuation has a separate final-source SQL comparison in
`cart-completion-before.json` and `cart-completion-after.json`; its method,
transaction overhead and checkout epoch-fence cost are documented in
[CART_README.md](CART_README.md). These cart measurements do not complete the
pending storefront browser/CPU comparison.

## Limits

Local demo data is a small catalog. These numbers do not establish performance
for the largest production menu, many nodes, or 100 simultaneous visitors.
Browser timing is distinct from handler SQL and background revision checks.
The final report must state background database cost separately from warm
handler savings and must not equate HTTP reduction with CPU reduction.
