# Production Deployment

Deploy Rescope Surveys as a hosted multi-tenant SaaS on a single Ubuntu VPS. This guide also applies when a self-hosted customer follows the same production-hardening pattern on their own server.

**Related:** [ARCHITECTURE.md](ARCHITECTURE.md) (design) · [OPERATIONS.md](OPERATIONS.md) (maintenance) · [DOCKER.md](DOCKER.md) (images)

---

## Overview

| Component | Where it runs |
|-----------|---------------|
| TLS and domain routing | Caddy on the VPS host (`systemctl`) |
| Application stack | Docker Compose — web, api, postgres, redis |
| Secrets | `/opt/rescopesurveys/.env` (generated on server, never committed) |
| Images | Docker Hub — `DOCKERHUB_USER/rescopesurveys-api` and `rescopesurveys-web` |

Two machines are involved:

| Machine | Typical prompt | Actions |
|---------|----------------|---------|
| **Workstation** | `user@laptop:~/survey-builder$` | Build images, sync files, SSH |
| **VPS** | `root@server:~#` | Bootstrap, deploy, backups |

---

## Prerequisites

### Server

| Requirement | Recommendation |
|-------------|----------------|
| OS | Ubuntu 22.04 or 24.04 LTS |
| Size | 2 vCPU / 4 GB RAM minimum (CX22 class); 4 vCPU / 8 GB for headroom |
| IPv4 | Required for Let's Encrypt and DNS A records |
| Firewall | Allow TCP 22, 80, 443 only |
| Docker Compose | v2.24+ (required for `ports: !override` in prod compose) |

### Domain

Plan four DNS names (replace `yourdomain.com` with yours):

| Host | Purpose |
|------|---------|
| `app.yourdomain.com` | SaaS dashboard (canonical) |
| `yourdomain.com` | Apex — same app until marketing site exists |
| `www.yourdomain.com` | Optional alias |
| `surveys.yourdomain.com` | Public survey taker URLs |

### Workstation

- SSH key added to the VPS at creation time
- Docker installed (for `publish-docker.sh`)
- This repository cloned

### Manual steps (cannot be scripted)

1. Purchase VPS and attach SSH key
2. Configure DNS A records at your registrar
3. Create the first user account in the browser after deploy (no seed accounts in production)

---

## Phase 1 — Publish images (workstation)

Publish a **version tag** so rollback is one command.

```bash
docker login
./scripts/deploy/publish-docker.sh v0.1.0
```

Images pushed:

- `{DOCKERHUB_USER}/rescopesurveys-api:v0.1.0`
- `{DOCKERHUB_USER}/rescopesurveys-web:v0.1.0`

Alternatively, push a git tag `v0.1.0` and let GitHub Actions publish — see [CI.md](CI.md).

---

## Phase 2 — DNS

Point all hosts at the VPS IPv4. Remove registrar parking or redirect records first.

| Type | Host | Value |
|------|------|-------|
| A | `@` | `VPS_IP` |
| A | `www` | `VPS_IP` |
| A | `app` | `VPS_IP` |
| A | `surveys` | `VPS_IP` |

Verify from your workstation:

```bash
dig +short app.yourdomain.com
dig +short surveys.yourdomain.com
```

All must return `VPS_IP`. Do not reload Caddy until DNS is correct — certificate issuance will fail and may hit Let's Encrypt rate limits.

---

## Phase 3 — Sync deployment files (workstation)

Copy Compose files, scripts, and the Caddyfile. **Do not copy your local `.env`.**

```bash
./scripts/deploy/sync-to-vps.sh root@VPS_IP
```

Default remote directory: `/opt/rescopesurveys`.

Files copied:

- `docker-compose.yml`, `docker-compose.prod.yml`
- `scripts/deploy/*.sh`
- `docker/caddy/Caddyfile`

---

## Phase 4 — Bootstrap the VPS

```bash
ssh root@VPS_IP
cd /opt/rescopesurveys
sudo ./scripts/deploy/bootstrap-vps.sh
```

This script (idempotent):

1. Installs Docker Engine and Compose plugin
2. Installs Caddy from the official apt repository
3. Copies `docker/caddy/Caddyfile` → `/etc/caddy/Caddyfile`
4. Reloads Caddy **only if** DNS check passes
5. Enables ufw: allow 22, 80, 443; deny all other inbound

**Customize domains:** edit `docker/caddy/Caddyfile` before bootstrap, or edit `/etc/caddy/Caddyfile` afterward and run `sudo caddy validate && sudo systemctl reload caddy`.

If bootstrap added your user to the `docker` group, reconnect SSH or run `newgrp docker`.

---

## Phase 5 — Generate production secrets (VPS)

```bash
cd /opt/rescopesurveys
IMAGE_TAG=v0.1.0 ./scripts/deploy/init-env.sh
```

The script:

- Writes `/opt/rescopesurveys/.env` with `openssl`-generated secrets
- Sets `chmod 600`
- Sets `COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml`
- **Refuses to overwrite** an existing `.env`

Store `POSTGRES_PASSWORD` securely off the server. Changing it in `.env` later does **not** update the password inside the existing Postgres volume.

### Key variables

| Variable | Purpose |
|----------|---------|
| `POSTGRES_PASSWORD` | Database password (strong, random) |
| `JWT_SECRET` | 32+ characters; required in production |
| `TOTP_ENCRYPTION_KEY` | Seals authenticator secrets. Required before two-factor enrollment. Losing it makes enrolled secrets unreadable |
| `INTERNAL_API_SECRET` | Protects Caddy on-demand TLS ask endpoint |
| `CORS_ORIGIN` | Comma-separated HTTPS origins — must include every app host |
| `SMTP_URL` | Outbound mail for invites, email confirmation, and password reset (`smtps://user:pass@host:465`). **Required** — the API refuses to start in production without it |
| `EMAIL_FROM` | Sender shown to recipients (default `Rescope Surveys <no-reply@rescopesurveys.com>`); the domain must be allowed to send via your SMTP provider (SPF/DKIM) |
| `APP_URL` | Base URL embedded in emailed links (default `https://app.rescopesurveys.com`) |
| `DOCKERHUB_USER` | Docker Hub account |
| `IMAGE_TAG` | Deployed version (e.g. `v0.1.0`) |
| `WEB_HOST_PORT` | Bare port number (`8080`); must match Caddyfile |
| `COMPOSE_FILE` | Enables production override on every `docker compose` command |

Caddy domains are configured in `/etc/caddy/Caddyfile`, not in `.env`.

---

## Phase 6 — Start the stack (VPS)

```bash
cd /opt/rescopesurveys
./scripts/deploy/deploy.sh
./scripts/deploy/verify.sh
```

`deploy.sh` validates secrets, pulls images, starts containers, and waits for `http://127.0.0.1:8080/health`. Prisma migrations run on first API boot (may take longer).

`verify.sh` confirms:

- `.env` is present and valid
- Port 8080 is bound to **127.0.0.1** only (not `0.0.0.0`)
- Caddy is active
- Public HTTPS responds when DNS is ready

### Security note on port 8080

ufw does not filter Docker-published ports. The loopback bind in `docker-compose.prod.yml` is the control that prevents direct internet access to the application. Never publish 8080 or 5432 publicly.

---

## Phase 7 — Backups (VPS)

```bash
./scripts/deploy/backup.sh --install-cron
```

- Writes `/opt/backups/rescopesurveys-YYYY-MM-DD-HHMM.sql.gz`
- Retains 14 days
- Runs nightly at 03:00

Copy dumps off the server regularly. A backup that exists only on the VPS is not a disaster-recovery plan.

---

## Phase 8 — Verification (browser and CLI)

| # | Check | Expected |
|---|-------|----------|
| 1 | `curl -sI https://app.yourdomain.com` | `200`, valid certificate |
| 2 | `curl https://app.yourdomain.com/health` | `{"status":"ok",...}` |
| 3 | Open `https://app.yourdomain.com` | Login / signup page |
| 4 | Sign up first account | Dashboard loads; no `admin/admin123` |
| 5 | Reload after signup | Session persists (HTTPS cookie check) |
| 6 | `curl -I https://surveys.yourdomain.com/test` | `200` SPA shell |
| 7 | Publish a survey, open public URL | Survey accepts a response |
| 8 | `docker compose ps` | All services `Up`; api and postgres `healthy` |

These must **fail** from the internet:

```bash
curl --max-time 5 http://yourdomain.com:8080/
nc -zv yourdomain.com 5432
```

---

## Self-hosted customer handoff

When delivering Docker images to an enterprise customer who runs their own infrastructure:

1. Provide versioned image names and tag (e.g. `v0.1.0`)
2. Provide `docker-compose.yml` and `docker-compose.prod.yml`
3. Provide this guide and [OPERATIONS.md](OPERATIONS.md)
4. Customer generates their own `.env` via `init-env.sh` or manually
5. Customer configures their domain in Caddyfile and DNS
6. Customer owns backups, monitoring, and upgrades

The customer receives the **full application** (UI + API + database schema), not logic-only. Data stays on their server.

---

## Customizing for your domain

1. Edit `docker/caddy/Caddyfile` — replace `rescopesurveys.com` hosts with yours
2. Re-sync to VPS: `./scripts/deploy/sync-to-vps.sh root@VPS_IP`
3. On VPS: `sudo cp /opt/rescopesurveys/docker/caddy/Caddyfile /etc/caddy/Caddyfile`
4. `sudo caddy validate && sudo systemctl reload caddy`
5. Update `CORS_ORIGIN` in `.env` to match all HTTPS origins
6. `docker compose up -d --force-recreate api`

---

## Script reference

| Script | Machine | Purpose |
|--------|---------|---------|
| `publish-docker.sh [tag]` | Workstation | Build and push images |
| `sync-to-vps.sh user@host` | Workstation | Copy deploy files (never `.env`) |
| `bootstrap-vps.sh` | VPS | Install Docker, Caddy, firewall |
| `init-env.sh` | VPS | Generate production `.env` |
| `check-dns.sh` | VPS | Verify DNS A records |
| `deploy.sh [tag]` | VPS | Pull, start, health check |
| `verify.sh` | VPS | Validate bind, health, TLS |
| `backup.sh [--install-cron]` | VPS | Database dump |

Ongoing maintenance: [OPERATIONS.md](OPERATIONS.md).
