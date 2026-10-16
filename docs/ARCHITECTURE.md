# Architecture & Design

This document explains how Rescope Surveys is structured — for operators who need to maintain a deployment and for developers who need to extend the product safely.

---

## 1. Product overview

Rescope Surveys is a browser-based survey authoring and delivery platform. A single codebase supports:

- **Survey builder** — drag-and-drop authoring, logic (visibility, termination, branching), branding
- **Survey taker** — public respondent experience with validation, piping, and device fingerprinting
- **Multi-tenant SaaS** — organizations, roles, billing, and a platform-owner console
- **Self-hosted deployment** — same Docker images on customer infrastructure with an isolated database

The frontend is a React SPA. The backend is a Fastify API with Prisma and PostgreSQL. Shared business logic lives in `shared/` and is imported by both tiers.

---

## 2. Infrastructure topology

### Production (recommended)

```
                         Internet
                            │
                            ▼
              ┌─────────────────────────┐
              │  Caddy (host process)   │
              │  Ports 80 / 443         │
              │  Let's Encrypt TLS      │
              │  Domain routing         │
              └───────────┬─────────────┘
                          │ HTTP
                          ▼
              ┌─────────────────────────┐
              │  127.0.0.1:8080       │  ← loopback only; never public
              └───────────┬─────────────┘
                          │
        ┌─────────────────┴─────────────────────────────────┐
        │              Docker Compose                        │
        │                                                    │
        │  ┌──────────┐    ┌──────────┐    ┌───────────┐  │
        │  │   web    │───▶│   api    │───▶│ postgres  │  │
        │  │  nginx   │    │ Fastify  │    │  volume   │  │
        │  │  :80     │    │  :3003   │    │  pgdata   │  │
        │  └──────────┘    └────┬─────┘    └───────────┘  │
        │                         │                          │
        │                    ┌────▼────┐                     │
        │                    │  redis  │                     │
        │                    │ :6379   │                     │
        │                    └─────────┘                     │
        └────────────────────────────────────────────────────┘
```

**Why two reverse-proxy layers?**

| Layer | Role |
|-------|------|
| **Caddy (host)** | Public TLS termination, multi-domain routing, on-demand certificates for enterprise custom domains |
| **nginx (web container)** | Serves the React build, proxies `/api/` to the API container, applies cache headers and embed CSP via `auth_request` |

Caddy is **not** a Docker service. It runs on the Ubuntu host via `systemctl`. Only the web container port is published — and in production it binds to `127.0.0.1` only (`docker-compose.prod.yml`).

### Sizing reference

| Tier | Spec | Typical use |
|------|------|-------------|
| CX22 | 2 vCPU, 4 GB RAM | Early SaaS, tens of concurrent survey takers |
| CX32 | 4 vCPU, 8 GB RAM | More headroom, larger orgs, heavier export workloads |

Load tests in `k6/` model capacity against a 2 CPU / 4 GB Docker budget. See [OPERATIONS.md](OPERATIONS.md#capacity-planning).

---

## 3. Domain and routing model

Replace `rescopesurveys.com` with your own domain in DNS and `/etc/caddy/Caddyfile`.

| Host | Purpose |
|------|---------|
| `app.yourdomain.com` | Canonical SaaS — login, dashboard, builder |
| `yourdomain.com` / `www` | Optional — same app until a separate marketing site exists |
| `surveys.yourdomain.com` | Public survey taker URLs (`/{publicPath}`) |
| `surveys.client.com` | Enterprise — verified custom domain per organization |

### Request routing inside the web container

| Path | Handler |
|------|---------|
| `/` | React SPA (static files) |
| `/api/*` | Reverse proxy → `api:3003` |
| `/health` | API health check |

### Public survey URL resolution

1. Respondent opens `https://surveys.yourdomain.com/my-project-090926` or `#/take/{surveyId}`.
2. nginx forwards to the API.
3. API resolves `publicPath` → survey record (globally unique slug).
4. Only **live** surveys with an **active** subscription are served.

Enterprise orgs with a verified custom domain get URLs on their own host. Logic lives in `shared/surveyUrl.js` and `server/src/lib/platform/orgSettings.js`.

---

## 4. Application layers

### 4.1 Frontend (`src/`)

| Area | Location | Responsibility |
|------|----------|----------------|
| Routing | `App.jsx`, `utils/appRoute.js` | Hash routes + white-label path URLs |
| Builder state | `store/surveyReducer.js`, `hooks/useAutosave.js` | Authoring state, debounced API saves |
| Logic engines | `utils/survey/` | Visibility, termination, branching, piping, validation — pure functions, no React |
| Question types | `questionHelpers.js` + editor/renderer registries | Single source of truth for 18+ types |
| API clients | `src/api/` | Thin fetch wrappers per domain |
| Persistence abstraction | `utils/data/*Store.js` | Branches on `useApi` — localStorage vs HTTP |

**Runtime modes** (controlled by `VITE_USE_API` at build time):

| Mode | Persistence | Auth |
|------|-------------|------|
| Local (`VITE_USE_API=false`) | Browser `localStorage` | Plain-text credentials in storage |
| API (`VITE_USE_API=true`) | PostgreSQL via Fastify | HttpOnly cookies + CSRF token |

Production Docker images are always built with `VITE_USE_API=true`.

### 4.2 Backend (`server/src/`)

| Area | Location | Responsibility |
|------|----------|----------------|
| Bootstrap | `index.js`, `app.js` | Config validation, plugin registration, route mounting |
| Auth | `plugins/auth.js`, `lib/auth/` | JWT in cookies, live role reload from DB, CSRF |
| Routes | `routes/*.js` | REST handlers per domain |
| Business logic | `lib/` | Billing, branding, survey paths, rate limits, org settings |
| Database | `prisma/schema.prisma` | Schema, migrations run on API startup |

### 4.3 Shared (`shared/`)

Code imported by both frontend (`@shared/`) and backend:

| Module | Purpose |
|--------|---------|
| `surveyUrl.js` | Public path slugs, white-label URL building, hostname parsing |
| `planFeatures.js` / `planCatalog.js` | Subscription feature matrix |
| `matrixAnswer.js` | Matrix answer normalization |
| `brandTheme.js`, `domainVerification.js` | Branding and DNS verification helpers |

Keeping URL and plan logic shared prevents client/server drift.

---

## 5. Multi-tenancy and authorization

### Tenant boundary

Every survey, user, response, and billing record belongs to an **Organization**. API handlers scope queries by `request.organizationId` derived from the authenticated user.

### Roles

| Role | Scope |
|------|-------|
| `admin` | Full access within their organization — all surveys, users, billing, platform lists |
| `editor` | Own surveys only (`createdById` filter) |
| `platform_owner` | Cross-tenant vendor console — subscriptions, invoices, org management |

JWTs are verified per request, but the **role is re-read from PostgreSQL** (2-second cache). Revoking access or changing roles takes effect on the next request.

### Platform owner console

Users with `platform_owner` are routed to `PlatformConsole` instead of the normal dashboard. From there you:

- List all organizations
- Assign subscription plan and status
- Set enterprise survey domains
- Create manual invoices
- Delete organizations (except the platform-owner org)

There is no payment processor integration yet — all plan changes are manual.

---

## 6. Data model

PostgreSQL via Prisma (`server/prisma/schema.prisma`).

| Model | Purpose |
|-------|---------|
| `Organization` | Tenant; `settings` JSONB holds brand kit, survey domain, DNS verification |
| `User` | Org member with role and bcrypt password hash |
| `Survey` | JSONB `survey` metadata + flat `items` array + monotonic `revision` |
| `Response` | JSONB payload per respondent session |
| `Client`, `Topic` | Optional platform metadata lists per org |
| `DncEntry` | Per-survey do-not-contact email list |
| `Subscription` | Plan, status, seats, billing period |
| `Invoice` | Manual invoice records |
| `RefreshToken` | Rotating opaque refresh tokens (hashed at rest) |

### Survey persistence

- **PATCH** `/api/surveys/:id` — client sends expected `revision`; server increments on success (optimistic concurrency).
- **publicPath** — globally unique slug generated from survey name + date; locked while survey is `live`.
- Items are a **flat array** (questions, page breaks, groups, text blocks, termination blocks) — not nested JSON trees.

### Response persistence

Public writes: `POST /api/public/surveys/:id/responses` (no auth).

Payload includes `status` (`complete` | `terminated` | `partial` | `dnc`), answer map, optional fingerprint, and `pageReached`.

---

## 7. Subscription plans

Defined in `shared/planCatalog.js` and enforced in `shared/planFeatures.js`.

| Plan | Surveys | Seats | Key features |
|------|---------|-------|--------------|
| `free_trial` | 5 | 1 | 14-day trial, core builder |
| `starter` | Unlimited | 5 | Email support |
| `professional` | Unlimited | 25 | Brand Kit, embeds, hide platform branding |
| `enterprise` | Unlimited | 100 | Custom verified domain, brand lock |

Plan assignment:

- **SaaS:** platform owner sets plan via Platform Console (`PATCH /api/vendor/organizations/:id/subscription`)
- **Self-service checkout:** not implemented (`selfService: false` on all paid plans)
- **Self-hosted:** customer can use local `platform_owner` account to set their own plan, or you configure the DB directly

### Enterprise custom domain flow (SaaS)

1. Platform owner sets plan to `enterprise` and enters `surveyDomain` (e.g. `client.com`).
2. Org admin opens billing → domain verification → creates TXT record.
3. Admin clicks **Check DNS** until status is `verified`.
4. Caddy issues on-demand TLS for `surveys.client.com` via `/api/internal/caddy-ask`.
5. Public survey URLs use the client's domain.

---

## 8. Security architecture (summary)

Production stack includes:

- HttpOnly cookie sessions with rotating refresh tokens
- Optional TOTP MFA for enrolled `admin` and `platform_owner` accounts
- CSRF protection on cookie-authenticated mutations
- Redis-backed distributed rate limiting
- CORS allowlist (never `*` in production)
- Loopback-only web container bind
- CSP and embed framing controls

Security layers: [SECURITY_CONTROLS.md](SECURITY_CONTROLS.md). Planned work by usage stage: [SECURITY_ROADMAP.md](SECURITY_ROADMAP.md).

---

## 9. Design principles

These conventions keep the codebase maintainable:

1. **Single source of truth for question types** — `questionHelpers.js` drives builder editors and taker renderers. Run `npm run check:registries` after changes.

2. **Pure logic outside React** — visibility, termination, conditions, branching, and piping are evaluated in `src/utils/survey/` without component state.

3. **Shared condition model** — one `conditionEngine` powers visibility rules, termination blocks, branch rules, and external redirects.

4. **Optimistic concurrency** — survey PATCH uses a revision counter; autosave serializes writes to avoid conflicts.

5. **Dual-mode stores** — `authStore`, `surveyLibrary`, etc. branch on `useApi` so UI code stays mode-agnostic.

6. **Live authorization** — never trust JWT role snapshots; reload from DB.

7. **Fail fast in production** — weak `JWT_SECRET`, missing `POSTGRES_PASSWORD`, or invalid `CORS_ORIGIN` prevent API startup.

---

## 10. Repository map (maintainer reference)

```
survey-builder/
├── src/                    React SPA
│   ├── api/                HTTP clients per domain
│   ├── components/
│   │   ├── auth/           Login
│   │   ├── dashboard/      Library, billing, PlatformConsole
│   │   ├── builder/        SurveyBuilder, editors, panels
│   │   ├── taker/          SurveyPreview, question renderers
│   │   └── shared/         Reusable UI (conditions, rich text, …)
│   ├── store/              Reducer, factories, initial state
│   └── utils/              Logic engines, CSV, persistence helpers
├── server/
│   ├── src/
│   │   ├── routes/         REST handlers
│   │   ├── plugins/        Auth, Prisma, CSRF, rate limits
│   │   └── lib/            Authz, billing, branding, survey paths
│   └── prisma/             Schema and migrations
├── shared/                 Cross-tier utilities
├── docker/
│   ├── nginx.conf          Web container routing
│   └── caddy/Caddyfile     Host TLS template
├── scripts/
│   ├── deploy/             VPS bootstrap, deploy, backup
│   ├── load/               k6 load tests
│   └── tests/              Unit and integration tests
├── k6/                     Load test script + stats sidecar
├── docker-compose.yml      Base stack
├── docker-compose.prod.yml Production override
└── docs/                   This documentation set
```

---

## 11. API surface (summary)

| Prefix | Auth | Purpose |
|--------|------|---------|
| `/api/auth/*` | Mixed | Signup, login, logout, session |
| `/api/dashboard` | JWT | Survey library with stats |
| `/api/surveys/:id` | JWT | Survey CRUD |
| `/api/surveys/:id/responses` | JWT | Response management and stats |
| `/api/platform/*` | JWT (admin writes) | Clients, topics, users |
| `/api/billing/*` | JWT (admin) | Subscription, brand kit, domain verification |
| `/api/vendor/*` | JWT (platform_owner) | Cross-org administration |
| `/api/public/*` | None | Live survey fetch, response submit, DNC check |
| `/api/internal/*` | Secret token | Caddy on-demand TLS ask, embed CSP |

Detailed frontend module reference: [CODE_REFERENCE.md](CODE_REFERENCE.md).

---

## 12. Release and migration flow

1. Developer merges to `main` → CI runs tests and Docker build validation.
2. Tag `v*.*.*` → images pushed to Docker Hub (or manual `publish-docker.sh`).
3. VPS runs `./scripts/deploy/deploy.sh vX.Y.Z` → pulls images, restarts containers.
4. API container runs Prisma migrations on startup.

**Important:** rolling back an image does **not** undo database migrations. If a release included a destructive migration, restore from backup before deploying the older image. See [OPERATIONS.md](OPERATIONS.md).
