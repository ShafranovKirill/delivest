# Repository validation — 2026-11-06

This report records the validation performed for the scaling/architecture audit and the ongoing PR #16 audit branch. Results below are from local logs or root-reported CI status; they validate the stated commands only and do not prove the static frontend findings are absent.

## Automated checks

| Area | Result | Evidence / notes |
|---|---:|---|
| Backend full test suite | **1321 tests, 0 failed, 7 excluded** | `MIX_ENV=test MIX_TEST_PARTITION=_scaling_audit_20261106 mix test`; [`backend full-suite log`](/tmp/delivest-scaling-audit-backend-full-tests.log). Ran against an isolated test partition. Existing LiveView form-id warning was emitted. |
| Backend focused order/payment/CRM/analytics tests | **37 tests, 0 failed** | [`focused backend log`](/tmp/delivest-scaling-audit-backend-tests.log). |
| Backend compile and formatter | **passed** | [`compile log`](/tmp/delivest-full-server-compile.log), [`format log`](/tmp/delivest-full-server-format.log); logs were empty on success. |
| Agent tests | **91 passed, 0 failed** | [`agent test log`](/tmp/delivest-full-agent-tests.log). The output contains a logged `cannot persist backup job status: {:error, :eisdir}` from the intentional `status persistence failure prevents engine execution` case in `agent/test/delivest_agent/backup_jobs_test.exs:137`; it is expected test-path logging, not an unexplained suite failure. |
| Client auth-session isolation tests | **7 passed, 0 failed** | [`client auth log`](/tmp/delivest-full-client-auth.log). This command is not wired into CI as `test:auth`. |
| Client typecheck | **passed** | [`typecheck log`](/tmp/delivest-full-client-typecheck.log). |
| Client build | **passed** | [`build log`](/tmp/delivest-full-client-build.log). Vite reports a generated map chunk above 1 MB and warns about chunks above 500 kB. |
| Client ESLint / Oxlint | **passed per run status** | [`ESLint log`](/tmp/delivest-full-client-eslint-all.log) includes `eslint-plugin-oxlint: could not find oxlint config file: .oxlintrc.json`; [`Oxlint log`](/tmp/delivest-full-client-oxlint-all.log) is empty. Treat the plugin message as an existing config warning. |
| Playwright E2E | **19 passed, 0 failed** | [`Playwright log`](/tmp/delivest-full-e2e-playwright.log). Run used a local isolated app/database; setup/seed/server/cleanup logs are in `/tmp/delivest-full-e2e-*.log`, and the temporary database was removed after the run. |
| Catalog branch-isolation reproduction | **3 passed, 0 failed** | [`sanitized repro result`](support/catalog-branch-isolation-repro-result.txt). The test intentionally asserts the currently observed buggy behavior. It used fresh partition `delivest_test_catalog_audit_20261106_v3`, which was dropped afterward. |
| Root shell syntax checks | **passed** | Root reports `bash -n deploy/host-nginx.sh scripts/release-notes.sh scripts/next-version.sh` passed. `shellcheck` was unavailable. |

## CI status

The root agent reports that all checks on PR #16 passed: [CI run 42201439993](https://github.com/ShafranovKirill/delivest/actions/runs/42201439993) completed backend in 5m53s, agent in 38s, and client in 36s; [Playwright run 42201439952](https://github.com/ShafranovKirill/delivest/actions/runs/42201439952) passed in 4m11s. PR #13 contains the client auth-session isolation fix; its local targeted auth run is listed above.

## Audit coverage limits

- Frontend static review directly read all 258 hand-maintained `client/src` files; generated API/type artifacts and static SVG/WOFF2 assets were excluded. The nine source findings are listed in [`2026-11-06-frontend.md`](2026-11-06-frontend.md) and were not browser-reproduced in this pass.
- A separate structural source review directly read all 23 `agent/lib` source files, all three `.github/workflows/*.yml` files, both files under `deploy/`, and all three root `scripts/`. Dependency/generated output was excluded. The pass did not run shellcheck, actionlint, nginx validation, deploy commands, or production operations.
- Backend report [`2026-11-06-backend-findings.md`](2026-11-06-backend-findings.md) records 641 inventoried `server/lib/**/*.ex` files and 200 inventoried test files. The completed focused review directly covered integration intake/provider/poller flows, order/identity/loyalty, catalog/import/export, site snapshot, media, selected finance/role/staff/integration LiveViews, plus a follow-up batch of 100 web files (25 LiveViews, 55 controllers, 20 channels/hooks/plugs) across delivery, courier, franchise, statistics, dashboard, kitchen, logs, and related endpoint paths. It did not read all 641 backend modules. All 200 test files were inventoried and the suite was executed; only finding-adjacent tests were read directly for coverage gaps. Do not describe suite counts or the earlier scoped architecture report as full backend source coverage.
- The catalog branch repro is a focused behavioral check, not a fix. It demonstrates shared product/category leakage into another branch's menu, cross-branch stop deletion, and stale other-branch menu cache after a branch-only product update. See [`repro source`](support/catalog-branch-isolation-repro.exs).
- Browser E2E covers tested customer, kitchen, courier, POS, and settings flows. It does not cover the nine static frontend issues unless an individual test explicitly does so.

## Agent and deployment findings from source review

These are static findings; no agent runtime scenario or deployment command was exercised in this pass.

### A02 — Backup job can remain claimed after the initial status write fails (medium recoverability risk)

`BackupJobs.claim/2` creates `jobs/<id>/claimed/` before persisting the initial `status.json`. When that write fails, the code logs the error and returns without removing the claim directory. The next poll sees the existing claim and only marks an existing `queued`/`waiting`/`running` status as interrupted; a missing or invalid status is otherwise ignored. The job can stay stuck until an operator repairs its files. The existing test `status persistence failure prevents engine execution` asserts that the claim directory remains (`agent/test/delivest_agent/backup_jobs_test.exs:137-144`) but does not cover recovery on a later poll. This is distinct from the already-reported stale `OperationLock` directory finding.

### D01 — Release is published before container images finish building (medium release integrity risk)

The release workflow pushes the version tag and creates the GitHub release in the `release` job before starting `build-and-push`. If any of its three image builds/pushes fail, the tag/release already exists without all published image variants; `fail-fast: false` also allows sibling variants to complete independently. See [`release.yml`](../../.github/workflows/release.yml:133) and the dependent image job at line 143. This is a workflow-ordering risk inferred from the job graph; no release was performed.

### CI validation gap — full checks do not gate pull requests targeting `main`

The full develop checks workflow handles push/PR only for `develop` (`checks.yml:3-7`). The release workflow runs unit/type/lint checks on `push` to `main`, after that commit reaches `main`; E2E separately handles PRs to `main`. Therefore a PR targeting `main` does not get the same full server, client, and agent checks before merge. The supported merge policy may make this uncommon, but the workflow itself does not enforce that policy. The workflows also contain no static validation job for the root shell scripts, host nginx installer, or gateway nginx template.
