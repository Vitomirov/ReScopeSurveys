# Rescope Surveys — Documentation

Professional documentation for deploying, operating, and maintaining Rescope Surveys on your own infrastructure.

---

## Who this is for

| Audience | Start here |
|----------|------------|
| **Platform operator** — run the SaaS on a VPS you control | [DEPLOY.md](DEPLOY.md) → [OPERATIONS.md](OPERATIONS.md) |
| **Developer** — contribute features or fix bugs | [DEVELOPMENT.md](DEVELOPMENT.md) → [ARCHITECTURE.md](ARCHITECTURE.md) |
| **DevOps / release engineer** — build images and automate delivery | [DOCKER.md](DOCKER.md) → [CI.md](CI.md) |
| **Maintainer** — understand design decisions and code layout | [ARCHITECTURE.md](ARCHITECTURE.md) → [CODE_REFERENCE.md](CODE_REFERENCE.md) · [ERROR_HANDLING.md](ERROR_HANDLING.md) |
| **QA** — manual regression after changes | [SMOKE_CHECKLIST.md](SMOKE_CHECKLIST.md) |

Security posture and remediation roadmap: [SECURITY_AUDIT.md](SECURITY_AUDIT.md) *(maintained separately)*.

---

## Documentation map

| Guide | Purpose |
|-------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, infrastructure, tenancy, data model, and how the codebase is organized |
| [DEPLOY.md](DEPLOY.md) | First-time production deployment on a single VPS (Caddy + Docker) |
| [OPERATIONS.md](OPERATIONS.md) | Day-2 maintenance — updates, backups, enterprise customers, monitoring, troubleshooting |
| [DOCKER.md](DOCKER.md) | Container images, Compose files, publishing to Docker Hub, partner/self-hosted pulls |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Local development setup, workflows, and verification |
| [CI.md](CI.md) | Continuous integration, release tagging, and automated VPS deployment |
| [CODE_REFERENCE.md](CODE_REFERENCE.md) | Frontend module layout, store actions, logic engines, and API surface |
| [ERROR_HANDLING.md](ERROR_HANDLING.md) | API and SPA error contracts, Prisma mapping, auth codes, and verification |
| [SMOKE_CHECKLIST.md](SMOKE_CHECKLIST.md) | Manual QA checklist for builder, taker, and export flows |

---

## Deployment models

Rescope Surveys supports two commercial delivery patterns from the **same codebase and Docker images**:

### 1. Hosted multi-tenant SaaS

You operate one VPS (or larger stack). Multiple customer organizations share a single PostgreSQL database. You control billing, plan assignment, and platform-wide settings through the **Platform Console** (`platform_owner` role).

- Canonical app host: `app.yourdomain.com`
- Public survey links: `surveys.yourdomain.com/{publicPath}`
- Enterprise customers can use verified custom domains: `surveys.client.com/{publicPath}`

→ Follow [DEPLOY.md](DEPLOY.md).

### 2. Self-hosted single-tenant (Docker)

A customer runs the full stack on **their** server with **their** database. Data never leaves their infrastructure. You deliver versioned images from Docker Hub plus Compose files and deployment documentation.

- One organization per deployment (isolated Postgres volume)
- Customer manages HTTPS, secrets, and backups
- No license server — entitlement is contractual

→ See [DOCKER.md](DOCKER.md) (images) and [DEPLOY.md](DEPLOY.md) (production hardening pattern).

---

## Compose files at a glance

| File | Use when |
|------|----------|
| `docker-compose.yml` | Base stack — Postgres, API, web. Partner demo or foundation for overrides |
| `docker-compose.dev.yml` | Local npm dev — exposes Postgres on `localhost:5433` |
| `docker-compose.prod.yml` | Production — no seed accounts, secure cookies, web bound to loopback only, Redis for rate limits |
| `docker-compose.load.yml` | Load testing — 2 CPU / 4 GB caps + k6 runner (separate project) |

Typical commands:

```bash
# Partner / local demo (Docker Hub images)
docker compose pull && docker compose up -d

# Local development (Postgres only)
npm run dev:docker

# Production VPS
COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml docker compose up -d
```

---

## Environments

```
┌──────────────────────────────────────────────────────────────────────────┐
│ DEVELOPMENT (laptop)                                                     │
│   Vite :5173 + API :3003 + Postgres :5433                              │
│   Hot reload, seeded accounts, relaxed rate limits                       │
│   → DEVELOPMENT.md                                                       │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ STAGING / DEMO (Docker on laptop or CI)                                  │
│   docker compose up -d  →  localhost:8080                                │
│   Pre-built Hub images, demo credentials                                 │
│   → DOCKER.md                                                            │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ PRODUCTION (VPS)                                                         │
│   Caddy :443 → 127.0.0.1:8080 → Docker (web → api → postgres + redis)  │
│   Real domain, HTTPS, strong secrets, no seed accounts                   │
│   → DEPLOY.md · OPERATIONS.md                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Recommended path before production

1. Develop and test locally — [DEVELOPMENT.md](DEVELOPMENT.md)
2. Run automated checks — `npm run check:registries && npm run test:track-a`
3. Build and publish versioned images — [DOCKER.md](DOCKER.md)
4. Demo the stack locally with Hub images — `docker compose up -d`
5. Read architecture and deployment guides — [ARCHITECTURE.md](ARCHITECTURE.md), [DEPLOY.md](DEPLOY.md)
6. Provision VPS, configure DNS, deploy — [DEPLOY.md](DEPLOY.md)
7. Set up backups and release process — [OPERATIONS.md](OPERATIONS.md), [CI.md](CI.md)

---

## Deploy scripts

| Script | Where | Purpose |
|--------|-------|---------|
| `scripts/deploy/publish-docker.sh` | Laptop | Build and push API + web images to Docker Hub |
| `scripts/deploy/sync-to-vps.sh` | Laptop | Copy Compose files, deploy scripts, and Caddyfile to the VPS |
| `scripts/deploy/bootstrap-vps.sh` | VPS | Install Docker, Caddy, ufw; install Caddyfile |
| `scripts/deploy/init-env.sh` | VPS | Generate production `.env` with `openssl` |
| `scripts/deploy/check-dns.sh` | VPS | Verify DNS A records point at this server |
| `scripts/deploy/deploy.sh` | VPS | Validate secrets, pull images, start stack, health check |
| `scripts/deploy/verify.sh` | VPS | Loopback bind, health, Caddy, public HTTPS |
| `scripts/deploy/backup.sh` | VPS | Postgres dump; `--install-cron` for nightly backups |
| `scripts/load/run-load-test.sh` | Laptop | k6 load test against capped Compose stack |
