# Docker Images & Distribution

Build, publish, and run Rescope Surveys as container images. This is the delivery mechanism for both your hosted SaaS and self-hosted enterprise customers.

**Related:** [DEPLOY.md](DEPLOY.md) · [OPERATIONS.md](OPERATIONS.md) · [CI.md](CI.md)

---

## Images

| Image | Contents |
|-------|----------|
| `{DOCKERHUB_USER}/rescopesurveys-api` | Fastify API, Prisma client, migrations run on startup |
| `{DOCKERHUB_USER}/rescopesurveys-web` | React production build + nginx (`VITE_USE_API=true`) |

Default account: `vitomirov`. Override with `DOCKERHUB_USER` in `.env`.

Postgres and Redis use upstream images (`postgres:16-alpine`, `redis:7.4-alpine`) — not custom-built.

---

## What customers receive

A self-hosted or partner deployment includes:

| Deliverable | Purpose |
|-------------|---------|
| API image | Application logic, auth, billing, survey/response APIs |
| Web image | User interface (builder, taker, dashboard) |
| `docker-compose.yml` | Base orchestration |
| `docker-compose.prod.yml` | Production hardening (recommended) |
| Deploy scripts | Bootstrap, secrets, backup |
| Caddyfile template | TLS and domain routing |

This is the **complete product** — not a logic-only SDK. The customer's Postgres volume holds all tenant data.

---

## Publish from your workstation

### 1. Log in

```bash
docker login
```

### 2. Build and push

```bash
# Latest (convenient for demos; avoid for production rollback)
./scripts/deploy/publish-docker.sh

# Version tag (recommended for production)
./scripts/deploy/publish-docker.sh v0.1.0
```

Pushes both `api` and `web` images with the given tag.

### 3. Verify on Docker Hub

Confirm both repositories show the expected tag digest.

---

## Run locally (pull from Hub)

```bash
docker compose pull
docker compose up -d
```

Open http://localhost:8080

| Login | Password |
|-------|----------|
| `admin` or `admin@rescopesurveys.local` | `admin123` |
| `vendor` or `vendor@rescopesurveys.local` | `vendor123` |

No `.env` required for demo — defaults in `docker-compose.yml` are not production-safe.

### Pin a version

Create `.env`:

```bash
DOCKERHUB_USER=vitomirov
IMAGE_TAG=v0.1.0
```

```bash
docker compose pull && docker compose up -d
```

### Reset database

```bash
docker compose down -v
docker compose pull
docker compose up -d
```

---

## Compose file comparison

| Setting | `docker-compose.yml` | `docker-compose.prod.yml` |
|---------|---------------------|---------------------------|
| Seed accounts | Yes (`admin/admin123`) | No — signup only |
| `COOKIE_SECURE` | `false` | `true` |
| Web port bind | `0.0.0.0:8080` | `127.0.0.1:8080` |
| Redis | Not included | Required. Rate-limit counters, plus the public-finish stream (`appendonly yes`, `volatile-lru`, 256 MB) |
| `REQUIRE_STRONG_JWT` | Off | On |
| Rate limits | Relaxed | Production quotas |

**Demo / partner:** base compose only.

**Production VPS:** base + prod override — see [DEPLOY.md](DEPLOY.md).

---

## Build locally without pushing

```bash
docker compose up --build -d
```

Uses local Dockerfiles. Good for testing changes before publish.

---

## Image internals

### API container

- Entrypoint: `docker/api-entrypoint.sh`
- Runs Prisma migrations on start
- Listens on port 3003 (internal only)
- Health check: `/health`

### Web container

- nginx serves static React build
- Proxies `/api/` to `api:3003`
- Config: `docker/nginx.conf`

### Data persistence

Postgres data lives in the `pgdata` Docker volume. Survives `docker compose down`. Destroyed only with `docker compose down -v`.

---

## CI publish

GitHub Actions publishes on `v*.*.*` git tags. Requires `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets. See [CI.md](CI.md).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Login fails with `admin/admin123` | Use email `admin@rescopesurveys.local`; or `docker compose down -v` |
| Port 8080 in use | `WEB_HOST_PORT=8081 docker compose up -d` |
| Stale image | `docker compose pull && docker compose up -d --force-recreate` |
| API restart loop | `POSTGRES_PASSWORD` in `.env` must match the password the `pgdata` volume was created with |
