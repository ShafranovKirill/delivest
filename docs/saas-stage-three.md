# SaaS stage 3: managed storefront address and media

The managed Node installs one pinned deployment package per franchise. The Compose project keeps PostgreSQL, S3 data, backup and public-site state in separate named volumes. `DELIVEST_PUBLIC_CONFIG_PATH` points to `/app/state/public-site.json` on a persistent volume. The initial primary URL comes from `CLIENT_ORIGIN`; Node changes it through `Delivest.PublicSite.apply_encoded/1` after HTTPS preparation. The API host (`PHX_HOST`) and media host (`S3_PUBLIC_HOST`) are stable when the storefront domain changes.

The server accepts a prepared new storefront origin for CORS and WebSocket before changing the primary URL. It writes the new configuration atomically and refuses malformed or insecure production origins. S3 bucket CORS is updated through the internal endpoint before the saved configuration changes. `Delivest.PublicSite.current_json/0` returns the current configuration for a Node rollback.

`Delivest.Release.setup_managed/0` requires a stable generated `ADMIN_PASSWORD` and fails if bucket creation, public read policy or bucket CORS cannot be established. `Delivest.Release.check_managed_storage/0` checks internal S3 writes and public HTTPS upload, read and signed private download, then removes its probe objects. Node uses this after the routes are prepared, before marking the installation ready.

For a managed production installation, the guest session and branch cookies use `Secure; SameSite=None` so an external HTTPS storefront can call the stable API host. Staff session cookies remain scoped as before. Browsers that block all third-party cookies still require a separate compatibility decision; the pilot must test guest checkout in the target browsers. An open guest cart is not transferred when the storefront domain changes, and customers may sign in again.

The targeted server checks are:

```sh
cd server
ERL_FLAGS='+S 4:4' MIX_TEST_PARTITION=saas_stage_three mix test \
  test/delivest/managed_storage_test.exs \
  test/delivest/managed_bootstrap_test.exs \
  test/delivest/public_site_test.exs \
  test/delivest/media_public_url_test.exs \
  test/delivest_web/helpers/cookie_helper_managed_test.exs \
  test/delivest_web/controllers/seo/seo_controller_test.exs \
  test/delivest/payments_test.exs \
  test/delivest/printing_test.exs \
  test/delivest/push/push_test.exs
mix compile --warnings-as-errors
cd ..
docker compose --env-file .env.example config --quiet
python3 scripts/test-install-release.py
```

Run `python3 scripts/test-managed-storage.py` explicitly to check real SeaweedFS 4.50 and Nginx 1.28 TLS on isolated Docker containers with temporary test credentials and a local CA. It verifies internal S3 operations, signed HTTPS public upload and read, signed private download, anonymous private denial, browser preflight for a new origin, and removal of that origin on rollback. The script binds random ports to loopback, verifies the test CA, and removes its containers and network on exit. It requires Docker, OpenSSL, and the server's compiled Mix dependencies. No customer data, production DNS, or production credentials are used.

The local storage integration and server contracts passed. An installation pilot must still verify a root domain and subdomain, managed and external DNS, browser guest checkout (including third-party cookie restrictions), payments in test mode, and rollback while another installation remains available. Production DNS, certificates and data are outside this stage's local work.

## Local validation record

- Server `64445d5`: 40 targeted tests passed in an independent run.
- Bastion `b59ab53`: 54 targeted tests passed in an independent run.
- Node `b2d392d`: 18 Elixir and 20 Python tests passed in independent runs; the same Python files passed at `890073a`. The production Mix release was rebuilt at `b2d392d`.
- Agent protocol baseline: 55 tests passed. Release installer: 11 tests passed.
- The committed `python3 scripts/test-managed-storage.py` passed independently: all six storage, TLS, CORS, and rollback results were true; its temporary containers and network were removed.

The `Dockerfile.server` image build did not complete. The first attempt timed out downloading Rebar3 from `builds.hex.pm` on Docker's default network; a host-network retry failed while resolving Debian Bookworm metadata because Docker Hub IPv6 was unreachable. No server image was published or verified ready. Full preflight, E2E, CI, push, and a real DNS/browser pilot were not run under the current authorization.
