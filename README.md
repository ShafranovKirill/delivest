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

Every push to `main` runs the server tests and the client type-check and lint, then builds and pushes both images with the `main` tag. Tags `v*` publish images with the same tag.

---

## Local development

Needs Docker, Elixir with Erlang, Node with pnpm and tmux. Only postgres and the S3 storage run in Docker (`server/docker-compose.yml`), the server and the client run in the console with code reloading.

First run:

```bash
git clone --recursive https://github.com/ShafranovKirill/delivest.git
cd delivest
make setup
```

`make setup` starts postgres and S3, installs the dependencies, creates and migrates the database, creates the buckets, seeds the roles and creates the admin account `admin123` / `AdminSecret123!`. Then run `make seed` for a branch with the example menu and promotions, or sign in to http://localhost:4000/staff and create a branch by hand.

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
| `make menu`       | Seed the first branch with the example menu and photos from `server/priv/images` |
| `make stocks`     | Seed the first branch with the example promotions and photos       |
| `make db-reset`   | Recreate the database and run `make seed`, **deletes all data**    |
| `make test`       | Server tests                                                       |
| `make check`      | Server compile warnings, format and tests, client type-check and lint |
| `make schema`     | Download the OpenAPI schema from the running server and regenerate the client API types |
| `make pull`       | Fast-forward this repository and every submodule                   |
| `make logs`       | Logs of postgres and S3                                            |

---

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

## Resetting the database

Migrations were squashed into the final schema before the first production release. A database created with the old migrations must be recreated, which **deletes all data**:

```bash
docker compose down
docker volume rm ${COMPOSE_PROJECT_NAME:-delivest}_postgres_prod_data
docker compose up -d
docker exec -it ${COMPOSE_PROJECT_NAME:-delivest}_server bin/delivest eval "Delivest.Release.setup"
```

Uploaded images live in the separate `s3_data` volume and are kept.

For local development: `cd server && mix ecto.reset && mix delivest.create_admin`.

---

## Backups

When the deployment is connected to the bastion, the bastion makes a database backup every day at 00:00 UTC and keeps the last 7 in its own storage. The agent runs `pg_dump -Fc` inside the `postgres` container without the `app_logs` data and uploads the file to the bastion over HTTPS. Uploaded images are not included.

From the instance page in the bastion a backup can be made, downloaded or restored, also into another deployment. On restore the agent stops the `server`, restores into a separate database, and only then swaps it with the live one. The previous database stays as `<DB_NAME>_before_restore` until the next restore, and the `server` runs the migrations on start. Manual steps are in [DEPLOY.md](DEPLOY.md#9-бэкапы).

---

## 📄 License

This project is currently under active development. License information will be added soon.
