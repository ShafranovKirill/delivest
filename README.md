# Delivest

**Delivest** is a food delivery platform: a Phoenix server (API, staff admin, integrations) and a Vue client (customer site). Both live in submodules and ship as Docker images published to **GitHub Container Registry (GHCR)**.

| Part     | Image                                          | Port inside the container |
| -------- | ---------------------------------------------- | ------------------------- |
| Server   | `ghcr.io/shafranovkirill/delivest-server`      | `4000`                    |
| Client   | `ghcr.io/shafranovkirill/delivest-client`      | `3000`                    |
| Database | `postgres:16-alpine`                           | `5432`                    |
| Files    | `chrislusf/seaweedfs` (S3 compatible storage) | `8333`                    |

Every push to `main` runs the server tests and the client type-check and lint, then builds and pushes both images with the `main` tag. Tags `v*` publish images with the same tag.

---

## Deployment

### 1. Prepare the host

You need Docker with the Compose plugin and three domains pointing to the host:

| Domain (example)               | Proxied to       | What it serves                             |
| ------------------------------ | ---------------- | ------------------------------------------ |
| `delivest-client.example.com`  | `127.0.0.1:3000` | Customer site                              |
| `delivest-server.example.com`  | `127.0.0.1:4000` | API, staff admin `/staff`, websockets, webhooks |
| `delivest-s3.example.com`      | `127.0.0.1:8333` | Product and promotion images               |

All containers publish their ports on `127.0.0.1` only, so the outside world reaches them through a reverse proxy with TLS.

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
| `S3_BIND_ADDRESS`                | `127.0.0.1`          | Host address the S3 port is published on                       |
| `ADMIN_LOGIN` / `ADMIN_PASSWORD` | `admin123` / random  | First admin account created by the setup step                  |
| `VITE_YANDEX_MAPS_API_KEY`       | —                    | Branch map on the customer site                                |

### 4. Configure the reverse proxy

The server uses websockets: `/live` for the staff admin and `/socket` for live order statuses and phone call confirmation on the customer site. The proxy must pass the `Upgrade` headers. Example for nginx:

```nginx
server {
    server_name delivest-server.example.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}

server {
    server_name delivest-client.example.com;
    location / { proxy_pass http://127.0.0.1:3000; }
}

server {
    server_name delivest-s3.example.com;
    client_max_body_size 20m;
    location / { proxy_pass http://127.0.0.1:8333; proxy_set_header Host $host; }
}
```

Add TLS (for example with `certbot --nginx`).

### 5. Start the containers

```bash
docker compose pull
docker compose up -d
```

Database migrations run automatically every time the server container starts.

### 6. Initial setup (once)

```bash
docker exec -it ${COMPOSE_PROJECT_NAME:-delivest}_server bin/delivest eval "Delivest.Release.setup"
```

It runs migrations, creates the S3 buckets, seeds roles and creates the admin account from `ADMIN_LOGIN` / `ADMIN_PASSWORD`. If `ADMIN_PASSWORD` is empty, a random password is printed once — save it.

Then open `https://delivest-server.example.com/staff`, sign in and create the first branch.

### 7. Connect integrations

- **Zvonok (sign-in by call):** in the zvonok.com campaign set a GET postback to
  `https://delivest-server.example.com/integrations/zvonok/<ZVONOK_WEBHOOK_TOKEN>`
  that passes the `call_id` and `phone` query parameters of the confirmed call.
- **Frontpad (CRM):** enable CRM in the branch settings in the admin, enter the API key and copy the webhook URL shown there (`/integrations/frontpad/<token>`) into Frontpad.

---

## Updating

```bash
git pull origin main
git submodule update --init --recursive
docker compose pull
docker compose up -d
```

New migrations are applied on container start.

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
