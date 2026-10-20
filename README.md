# Delivest

**Delivest** is a full-stack food delivery platform that integrates client and server submodules into a unified containerized deployment published via **GitHub Container Registry (GHCR)**.

> **Status:** 🚧 Active Development — Delivest combines robust backend services with modern web interfaces, streamlining automated builds and deployments.

---

## Getting Started

#### 1. Clone the repository

```bash
git clone --recursive https://github.com/ShafranovKirill/delivest.git
cd delivest
```

> **Note:** If you already cloned the repository without submodules, initialize and update them manually:
>
> ```bash
> git submodule update --init --recursive
> ```

#### 2. Start the Server

Spin up the application containers using Docker Compose:

```bash
docker compose up -d
```

#### 3. Initial Setup & Release Initialization

After the containers are running, execute the release setup command once. It creates the S3 buckets, seeds roles and creates the admin account:

```bash
docker exec -it ${COMPOSE_PROJECT_NAME:-delivest}_server bin/delivest eval "Delivest.Release.setup"
```

The admin login and password are taken from `ADMIN_LOGIN` / `ADMIN_PASSWORD`. If `ADMIN_PASSWORD` is not set, a random password is generated and printed once — save it.

Database migrations run automatically every time the server container starts.

#### Environment variables added in this version

| Variable | Default | Purpose |
| --- | --- | --- |
| `S3_PRIVATE_BUCKET` | `delivest-private` | Bucket for private files (must differ from `S3_BUCKET`) |
| `S3_BIND_ADDRESS` | `127.0.0.1` | Host address the S3 port is published on; keep it local and expose S3 via the reverse proxy |
| `APP_TIMEZONE` | `Europe/Moscow` | Business time zone for "today"/"yesterday" order filters |
| `ADMIN_LOGIN` / `ADMIN_PASSWORD` | `admin123` / random | Credentials used by `Delivest.Release.setup` |

S3 now requires `S3_ACCESS_KEY` / `S3_SECRET_KEY` for writes and listing; anonymous visitors can only read objects from `S3_BUCKET`.

---

## Updating the Project

To update the application on your server when changes are pushed to the repository or submodules:

```bash
git pull origin main
git submodule update --remote --merge
docker compose pull
docker compose up -d
```

---

## 📦 Container Registry

Container images are automatically built and published to **GitHub Container Registry (GHCR)**:

```
ghcr.io/shafranovkirill/delivest
```

---

## 📄 License

This project is currently under active development. License information will be added soon.
