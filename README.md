# Delivest

**Delivest** is a food delivery platform: a Phoenix server (API, staff admin, integrations), a Vue client (customer site) and a deployment agent. All three live in submodules and ship as Docker images published to **GitHub Container Registry (GHCR)**.

| Part     | Image                                          |
| -------- | ---------------------------------------------- |
| Gateway  | `nginx:1.28-alpine` with `deploy/nginx/gateway.conf.template` |
| Server   | `ghcr.io/shafranovkirill/delivest-server`      |
| Client   | `ghcr.io/shafranovkirill/delivest-client`      |
| Database | `postgres:16-alpine`                           |
| Files    | `chrislusf/seaweedfs` (S3 compatible storage)  |
| Agent    | `ghcr.io/shafranovkirill/delivest-agent`       |

Only the gateway publishes a port (`127.0.0.1:${GATEWAY_PORT}`). It routes requests by domain to the server, the client and the file storage and holds all proxy settings: websockets, upload limits, gzip and long caching of product images. The host nginx only terminates TLS and forwards the three domains to the gateway, so several deployments can live on one server side by side.

```
browser ──https──▶ host nginx (TLS, certbot) ──▶ 127.0.0.1:GATEWAY_PORT ──▶ gateway ──▶ server / client / s3
```

`main` is production. Every push to `main` runs the server and agent tests, client type-check and lint, and Playwright E2E tests. Only after all checks pass, it releases a new version:

1. `scripts/next-version.sh` picks the next version from the commits since the last `v*` tag: a `!` or `BREAKING CHANGE` bumps the major, a `feat:` bumps the minor, anything else bumps the patch.
2. The commit is tagged `vX.Y.Z` and a GitHub Release is published with the notes from `scripts/release-notes.sh` (new features and fixes since the last tag).
3. The server, client and agent images are pushed with the tags `X.Y.Z`, `X.Y` and `latest` and carry the version in the `org.opencontainers.image.version` label. The server also gets it as `APP_VERSION` and shows it at the bottom of the admin sidebar.

The agent reports the version of every running container, and the bastion shows the version of each site next to the newest one in the registry.

---

## Local development

Needs Docker, Elixir with Erlang, Node with pnpm and tmux. Postgres, S3 storage and the backup agent run in Docker (`server/docker-compose.yml`); the server and client run in the console with code reloading. `make infra` builds and starts the local agent. Keep `server/.instance-backups` on the host: it carries backup jobs and archives shared with the Phoenix process. The local Seaweed image is pinned to the same version as production, and `make infra` updates it before backups are used. Restart the local Phoenix process after updating the backup setup; `make dev` only attaches to an existing tmux session and does not restart it.

First run:

```bash
git clone --recursive https://github.com/ShafranovKirill/delivest.git
cd delivest
make setup
```

`make setup` starts postgres and S3, installs the dependencies, creates and migrates the database, creates the buckets, seeds the roles and creates the admin account `admin123` / `AdminSecret123!`. Then run `make seed` for the legacy example menu and promotions, or sign in to http://localhost:4000/staff and create a branch by hand. For the current standard test configuration (5 categories, 30 products, 6 banners), use `make demo-menu` after a local branch and staff account exist. It reads `DEMO_MENU_BRANCH_SLUGS` (default: `demo-center,demo-north,demo-south`) and uses only the already configured local database and S3; see [examples/demo-menu/README.md](examples/demo-menu/README.md).

Every day:

```bash
make dev
```

It starts postgres and S3 and opens a tmux session `delivest` with the server (`iex -S mix phx.server`) on the left and the client (`pnpm dev`) on the right. Running it again attaches to the same session, `make stop` closes it. Without tmux run `make server` and `make client` in two terminals.

| Address                        | What                         |
| ------------------------------ | ---------------------------- |
| http://localhost:3000          | Customer site                |
| http://localhost:4000/staff    | Staff admin                  |
| http://localhost:4000/api/openapi | OpenAPI schema of the client API |

The client must run on port 3000, the server accepts requests only from `http://localhost:3000`, so the client stops with an error if the port is busy.

| Command           | What it does                                                       |
| ----------------- | ------------------------------------------------------------------ |
| `make infra`      | Start only postgres and S3                                         |
| `make infra-down` | Stop postgres and S3                                               |
| `make server`     | Start only the server                                              |
| `make client`     | Start only the client                                              |
| `make seed`       | Everything below at once: buckets, roles, admin, branch, menu and promotions |
| `make roles`      | Seed the system roles                                              |
| `make admin`      | Create the admin account                                           |
| `make branch`     | Fill the first branch info (address, phone, schedule, map) and the franchise settings (name, about, legal details) with example data |
| `make demo-menu`  | Apply the current standard local test menu: 30 products and 6 banners |
| `make menu`       | Seed the first branch with the example menu and photos from `server/priv/images` |
| `make stocks`     | Seed the first branch with the example promotions and photos       |
| `make db-reset`   | Recreate the database and run `make seed`, **deletes all data**    |
| `make test`       | Server tests                                                       |
| `make check`      | Server compile warnings, format and tests, client type-check and lint |
| `make preflight`  | Prepare a separate E2E database and run client/E2E type checks and all Playwright tests |
| `make install-pre-push` | Install a local pre-push hook that runs `make preflight` if no hook exists |
| `make schema`     | Download the OpenAPI schema from the running server and regenerate the client API types |
| `make pull`       | Fast-forward this repository and every submodule                   |
| `make logs`       | Logs of postgres and S3                                            |

Run `make preflight` before pushing to `develop` and again before releasing to `main`. Start local Postgres and S3 first. Each run creates a fresh timestamped `delivest_e2e_preflight_*` database, migrates and seeds it, installs client and E2E dependencies with frozen lockfiles, checks their types, and runs Playwright against its own server and client on ports 4100 and 3100. It does not drop a database or start Docker. Previous preflight databases remain and can be removed manually when no longer needed. You can set `PREFLIGHT_DATABASE` to a fresh name beginning with `delivest_e2e` for a diagnostic run; reuse of a database after Playwright is not supported because tests change the seed data. To run a focused E2E check, pass Playwright arguments, for example `make preflight PLAYWRIGHT_ARGS=tests/checkout-return.spec.ts`.

Optionally run `make install-pre-push` to check automatically before each push. The installer leaves an existing pre-push hook unchanged. The hook runs the full preflight and requires local Postgres and S3 to be available.

---

### Persistent local demo

Run `make demo` for a ready admin and customer site. On first use it prepares the dedicated PostgreSQL database `delivest_f01_demo_local`, adds historical orders for statistics, a 30-product menu with WebP photos and banners, and modifier choices. Later runs keep that data and skip the seed and asset upload. The admin is at http://localhost:4000/staff/auth/login (`demo_admin` / `DemoPassword123!`); the customer site is at http://localhost:3000/demo-center. External delivery and payment integrations stay disabled in this demo.

`make demo-prepare` prepares the data without starting the web processes. `make demo-stop` stops only the managed demo tmux session. `DEMO_RESET=yes make demo-reset` deletes only the dedicated demo database, including local edits; the next `make demo` recreates it. The public S3 demo assets use the existing local bucket. The demo has persistent data rather than a binary database snapshot. If ports 4000 or 3000 are occupied by another running app, stop that app first; for a parallel preview use `DEMO_SERVER_PORT=4200 DEMO_CLIENT_PORT=3200 make demo`. Logs: `/tmp/delivest-local-demo-server.log` and `/tmp/delivest-local-demo-client.log`.

## Deployment

Step-by-step guide in Russian for an empty server: [DEPLOY.md](DEPLOY.md).

### Quick start

On a clean Ubuntu or Debian server, as root:

```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
apt install -y nginx certbot python3-certbot-nginx

git clone --recursive https://github.com/ShafranovKirill/delivest.git
cd delivest
cp .env.example .env
nano .env

./deploy/host-nginx.sh

docker compose pull
docker compose up -d
docker compose logs server --tail 20

docker compose exec server bin/delivest eval "Delivest.Release.setup"
```

Before `host-nginx.sh` make sure all three domains already resolve to the server (`dig +short <domain>`) and ports 80 and 443 are open (`ufw allow 'Nginx Full'` if ufw is enabled), otherwise certbot cannot issue the certificate. The steps below explain each command.

### 1. Prepare the host

Install Docker with the Compose plugin, nginx and certbot:

```bash
curl -fsSL https://get.docker.com | sh
apt install -y nginx certbot python3-certbot-nginx
```

`docker-compose-plugin` is not in the stock Ubuntu and Debian repositories, the official script installs it together with Docker.

Point three domains to the host:

| Domain (example)               | What it serves                                  |
| ------------------------------ | ----------------------------------------------- |
| `delivest-client.example.com`  | Customer site                                   |
| `delivest-server.example.com`  | API, staff admin `/staff`, websockets, webhooks |
| `delivest-s3.example.com`      | Product and promotion images                    |

### 2. Clone the repository

```bash
git clone --recursive https://github.com/ShafranovKirill/delivest.git
cd delivest
```

If you cloned without submodules:

```bash
git submodule update --init --recursive
```

### 3. Configure `.env`

```bash
cp .env.example .env
```

Fill in at least:

| Variable                                   | Value                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `COMPOSE_PROJECT_NAME`                     | Unique name of this deployment, e.g. `delivest`                             |
| `GATEWAY_PORT`                             | Free local port for the gateway, e.g. `8080`                                |
| `PHX_HOST`                                 | Server domain without scheme, e.g. `delivest-server.example.com`            |
| `SECRET_KEY_BASE`                          | `openssl rand -base64 48`                                                   |
| `CLIENT_ORIGIN`                            | Client URL with scheme, e.g. `https://delivest-client.example.com`. Used for CORS and the websocket origin check |
| `DB_PASSWORD`                              | Any strong password                                                         |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY`          | Credentials for the file storage, any strong values                         |
| `S3_HOST` / `S3_PUBLIC_HOST`               | S3 domain without scheme                                                    |
| `VITE_API_BASE_URL`                        | Server URL with scheme, e.g. `https://delivest-server.example.com`          |

Optional:

| Variable                         | Default              | Purpose                                                        |
| -------------------------------- | -------------------- | -------------------------------------------------------------- |
| `APP_TIMEZONE`                   | `Europe/Moscow`      | Business time zone: "today" filters, closing orders of past days |
| `DEFAULT_LOCALE`                 | `ru`                 | Admin language for new staff sessions                          |
| `S3_BUCKET`                      | `delivest`           | Public bucket for images                                       |
| `S3_PRIVATE_BUCKET`              | `delivest-private`   | Private bucket, must differ from `S3_BUCKET`                   |
| `ADMIN_LOGIN` / `ADMIN_PASSWORD` | `admin123` / random  | First admin account created by the setup step                  |
| `BASTION_URL` / `BASTION_TOKEN`  | —                    | Bastion address (`wss://...`) and token for the agent; empty keeps the agent idle |
| `INSTANCE_NAME`                  | `PHX_HOST`           | Name of this deployment in the bastion                         |
| `AGENT_UPDATE_HEALTH_SECONDS`    | `300`                | How long an update waits for the site before it rolls back     |

### 4. Connect the host nginx

```bash
sudo ./deploy/host-nginx.sh
```

The script reads the domains and `GATEWAY_PORT` from `.env`, writes `/etc/nginx/sites-available/<COMPOSE_PROJECT_NAME>.conf` that forwards the three domains to the gateway, reloads nginx and asks certbot for one certificate covering all three domains with an HTTP → HTTPS redirect. Certbot renews it automatically.

Run it again after changing domains or the port; the existing certificate is reinstalled.

If the server already has a hand-written config for the same domains, remove it first, otherwise nginx reports conflicting `server_name`.

### 5. Start the containers

```bash
docker compose pull
docker compose up -d
```

Database migrations run automatically every time the server container starts.

### 6. Initial setup (once)

```bash
docker compose exec server bin/delivest eval "Delivest.Release.setup"
```

It runs migrations, creates the S3 buckets, seeds roles and creates the admin account from `ADMIN_LOGIN` / `ADMIN_PASSWORD`. If `ADMIN_PASSWORD` is empty, a random password is printed once — save it.

Then open `https://delivest-server.example.com/staff`, sign in, fill in **Franchise settings** (name, description, brand color, site icon, link preview image, seller details, legal documents) and create the first branch. The client nginx pulls the page title, Open Graph tags, icons, `robots.txt`, `sitemap.xml` and `site.webmanifest` from the server, so changes show up without a restart.

### 7. Connect integrations

- **Zvonok (sign-in by call):** in the admin open **Integrations → Sign-in by phone number**, enter the zvonok.com API key and campaign ID, save, and paste the shown webhook URL as a whole into the postback of the campaign. It already carries the Zvonok macros `{ct_call_id}` and `{ct_phone}`, without them the server cannot tell which call was confirmed. Every postback is written to the staff logs. Shared by all branches.
- **Frontpad (CRM):** in the admin open **Integrations → Frontpad** for the branch, enter the API key, turn on sending orders and copy the shown webhook URL (`/integrations/frontpad/<token>`) into Frontpad.

---

## Several deployments on one server

Clone the repository into a separate directory for every site and give each `.env` its own values:

```dotenv
COMPOSE_PROJECT_NAME=pizza
GATEWAY_PORT=8081
PHX_HOST=api.pizza.example.com
CLIENT_ORIGIN=https://pizza.example.com
S3_HOST=files.pizza.example.com
S3_PUBLIC_HOST=files.pizza.example.com
```

Then run `docker compose up -d` and `sudo ./deploy/host-nginx.sh` in that directory. Containers, volumes and networks are prefixed with the project name, so deployments do not share data.

---

## Updating

In the deployment directory:

```bash
git pull origin main
git submodule update --init --recursive
docker compose pull
docker compose up -d
docker compose restart gateway
docker compose logs server --tail 20
docker image prune -f
```

New migrations are applied on container start. The gateway restart picks up changes in `deploy/nginx/gateway.conf.template`. `docker image prune -f` removes the old image layers left after the pull.

`host-nginx.sh` is not needed on updates: the host nginx only forwards traffic to the gateway, and certbot renews the certificate on its own. Run the script again only after changing the domains or `GATEWAY_PORT` in `.env`.

With several deployments on one server, repeat the update in each directory.

---

## Agent

The `agent` service connects this deployment to the bastion over a websocket at `BASTION_URL/agent/websocket` and registers itself with `BASTION_TOKEN`; the instance id is kept in the `agent_data` volume. Every 30 seconds it reports the containers with their image revisions and how many times docker restarted them after a crash, its own image and revision, the free disk space, the CPU, memory and load of the host, whether the API and the site answer through the gateway, and the names of the variables from `.env.example` that are missing in `.env` (never their values). One query to postgres adds the orders of the last day that failed to reach the CRM or have been waiting for it for more than 5 minutes, the orders of the last hour with the average for the same hour of the previous 4 weeks, the application errors of the last 5 minutes and hour with the latest messages, and the size of the database. The bastion keeps the load for a month and alerts about high load, orders that finally failed to reach the CRM, an hour without orders when they usually come, bursts of errors, crashing containers and an almost full disk.

The bastion can run `status`, `update`, `rollback`, `agent_update`, `start`, `stop`, `restart`, `logs`, `env_read`, `env_write`, `backup` and `restore`. They act on every service of this deployment except the agent itself, so the agent stays online while the site is stopped or updated.

`update` first backs up the database to the bastion when the bastion asks for it and stops if the backup fails. Then it tags the running images as `delivest-previous` and remembers the git revision, runs `git pull` as the owner of the deployment directory, `docker compose pull`, `docker compose up -d` and restarts the gateway. After that it waits until every container runs and the API and the site answer twice in a row, for up to `AGENT_UPDATE_HEALTH_SECONDS` (300 by default). If they do not, it brings back the previous images and git revision; otherwise it prunes dangling images. `rollback` does the same return by hand. The database is never rolled back, the backup made before the update is in the bastion.

`agent_update` pulls the agent image and recreates the agent from a short-lived helper container started from that image, so the agent also picks up a changed `.env`.

The bastion can also read and replace the `.env` of the deployment (`env_read`, `env_write`). On write the agent keeps the previous file as `.env.bak`, preserves its owner and mode, then runs `docker compose up -d` and restarts the gateway so every service picks up the new values. The agent itself keeps its old environment until it is updated from the bastion or restarted by hand (`docker compose up -d agent`).

The agent needs the docker socket and the deployment directory mounted at the same path as on the host (`${PWD}:${PWD}`), so run `docker compose` from the deployment directory.

## Database baseline

Upgrade existing installations to `v1.2.6` before installing a release with the baseline migrations. At startup the first baseline migration checks for the full `v1.2.6` migration history and its tables. The baseline migrations are then recorded as applied, preserving the previous migration records, schema and data. An installation that has not finished the earlier migrations must complete the upgrade through `v1.2.6` first.

A fresh installation builds the same schema from nine migrations organized by module. A cross-module foreign key is created in the migration that runs after both of its tables are available. The old release can still run against an upgraded database with its old migration records. Use a baseline-aware release for databases created from scratch with the baseline.

An administrator can populate missing role presets from **Staff → Roles → Create Base Roles**. The button preserves existing roles and staff assignments. Staff who retry fiscal receipts or issue refund receipts need the corresponding finance permission. The Accountant preset includes both permissions.

---

## Backups

Administrators can use **Staff → Franchise → Full instance backup** to create and download a `.tar` archive of the entire PostgreSQL database and SeaweedFS storage, then restore it with an explicit full replacement confirmation. The site disconnects during restore; sign in afterward with staff credentials from the source archive. Branch and franchise ZIP snapshots are a separate legacy format and cannot be imported here. Source and target application releases must be compatible, and target migrations must include those recorded in the archive; start and migrate a fresh target before uploading. The source and target must use the same SeaweedFS image ID and bucket names. The target deployment environment remains in place. Jobs and archives live in the shared `instance_backups` volume in production or `server/.instance-backups` during local development. The default upload limit is 20 GiB (`INSTANCE_BACKUP_MAX_ARCHIVE` in bytes). Unsafe interrupted jobs keep the application stopped for operator review. The previous database and a directory copy of the previous storage contents remain as recovery artifacts after replacement. Completed jobs and archives also remain in the shared volume; remove them according to a retention policy after verifying the restored site to avoid filling the disk. The CLI fallback is `scripts/full-backup` (`--replace` for import, `--leave-stopped` for cutover export).

For single-node SeaweedFS restores, the agent rebuilds only the master's election and membership state from its complete volume mirror. It keeps the volume counter, topology ID, growth state, all filer and volume data, and the original archive. A missing or incomplete mirror rejects the restore before changing the target.

### Bastion database backups

When the deployment is connected to the bastion, the bastion makes a database backup every day at 00:00 UTC and keeps the last 7 in its own storage. The agent runs `pg_dump -Fc` inside the `postgres` container without the `app_logs` data and uploads the file to the bastion over HTTPS. Uploaded images are not included.

From the instance page in the bastion a backup can be made, downloaded or restored, also into another deployment. On restore the agent stops the `server`, restores into a separate database, and only then swaps it with the live one. The previous database stays as `<DB_NAME>_before_restore` until the next restore, and the `server` runs the migrations on start. Manual steps are in [DEPLOY.md](DEPLOY.md#9-бэкапы).

---

## 📄 License

This project is currently under active development. License information will be added soon.
