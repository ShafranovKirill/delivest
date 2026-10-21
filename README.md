# Delivest

**Delivest** is a food delivery platform: a Phoenix server (API, staff admin, integrations) and a Vue client (customer site). Both live in submodules and ship as Docker images published to **GitHub Container Registry (GHCR)**.

| Part     | Image                                          |
| -------- | ---------------------------------------------- |
| Gateway  | `nginx:1.28-alpine` with `deploy/nginx/gateway.conf.template` |
| Server   | `ghcr.io/shafranovkirill/delivest-server`      |
| Client   | `ghcr.io/shafranovkirill/delivest-client`      |
| Database | `postgres:16-alpine`                           |
| Files    | `chrislusf/seaweedfs` (S3 compatible storage)  |

Only the gateway publishes a port (`127.0.0.1:${GATEWAY_PORT}`). It routes requests by domain to the server, the client and the file storage and holds all proxy settings: websockets, upload limits, gzip and long caching of product images. The host nginx only terminates TLS and forwards the three domains to the gateway, so several deployments can live on one server side by side.

```
browser ──https──▶ host nginx (TLS, certbot) ──▶ 127.0.0.1:GATEWAY_PORT ──▶ gateway ──▶ server / client / s3
```

Every push to `main` runs the server tests and the client type-check and lint, then builds and pushes both images with the `main` tag. Tags `v*` publish images with the same tag.

---

## Deployment

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
| `VITE_CAFE_NAME` / `VITE_SITE_DESCRIPTION` | Shown on the customer site                                                  |
| `ZVONOK_PUBLIC_KEY` / `ZVONOK_CAMPAIGN_ID` | zvonok.com API key and campaign for sign-in by phone call                   |
| `ZVONOK_WEBHOOK_TOKEN`                     | Any random string, it becomes part of the webhook URL                       |

Optional:

| Variable                         | Default              | Purpose                                                        |
| -------------------------------- | -------------------- | -------------------------------------------------------------- |
| `APP_TIMEZONE`                   | `Europe/Moscow`      | Business time zone: "today" filters, closing orders of past days |
| `DEFAULT_LOCALE`                 | `ru`                 | Admin language for new staff sessions                          |
| `S3_BUCKET`                      | `delivest`           | Public bucket for images                                       |
| `S3_PRIVATE_BUCKET`              | `delivest-private`   | Private bucket, must differ from `S3_BUCKET`                   |
| `ADMIN_LOGIN` / `ADMIN_PASSWORD` | `admin123` / random  | First admin account created by the setup step                  |
| `VITE_YANDEX_MAPS_API_KEY`       | —                    | Branch map on the customer site                                |

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

Then open `https://delivest-server.example.com/staff`, sign in and create the first branch.

### 7. Connect integrations

- **Zvonok (sign-in by call):** in the zvonok.com campaign set a GET postback to
  `https://delivest-server.example.com/integrations/zvonok/<ZVONOK_WEBHOOK_TOKEN>`
  that passes the `call_id` and `phone` query parameters of the confirmed call.
- **Frontpad (CRM):** enable CRM in the branch settings in the admin, enter the API key and copy the webhook URL shown there (`/integrations/frontpad/<token>`) into Frontpad.

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

```bash
docker exec ${COMPOSE_PROJECT_NAME:-delivest}_prod_postgres \
  pg_dump -U "$DB_USER" -Fc "$DB_NAME" > delivest-$(date +%F).dump
```

Restore into an empty database:

```bash
docker exec -i ${COMPOSE_PROJECT_NAME:-delivest}_prod_postgres \
  pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists < delivest-2026-01-01.dump
```

---

## 📄 License

This project is currently under active development. License information will be added soon.
