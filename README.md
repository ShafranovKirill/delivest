# Delivest

**Delivest** is a full-stack food delivery platform that integrates client and server submodules into a unified containerized deployment published via **GitHub Container Registry (GHCR)**.

> **Status:** 🚧 Active Development — Delivest combines robust backend services with modern web interfaces, streamlining automated builds and deployments.

---

## ✨ Features

- 🧩 **Integrated Architecture** — Combines submodules for client and server layers into a single cohesive deployment workflow.
- 🚀 **Automated Container Publishing** — Automatically builds and pushes container images to GitHub Container Registry (GHCR).
- 🐳 **Dockerized Environment** — Fully containerized setup via Docker Compose for fast and consistent deployments.

---

## 🚀 Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)
- [Git](https://git-scm.com/) (with submodule support)

### Installation & Deployment

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

After the containers are running, execute the release setup command to perform initial configurations and database migrations:

```bash
docker exec -it delivest_server bin/delivest eval "Delivest.Release.setup"
```

---

## 🔄 Updating the Project

To update the application on your server when changes are pushed to the repository or submodules:

```bash
git pull origin main
git submodule update --remote --merge
docker compose pull
docker compose up -d
```

---

## 📁 Project Structure

| Path                 | Description                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `docker-compose.yml` | Service and environment configurations.                                                                                 |
| `Submodules`         | Separate repositories handling client and server logic, assembled into a single production container published to GHCR. |

---

## 📦 Container Registry

Container images are automatically built and published to **GitHub Container Registry (GHCR)**:

```
ghcr.io/shafranovkirill/delivest
```

---

## 📄 License

This project is currently under active development. License information will be added soon.
