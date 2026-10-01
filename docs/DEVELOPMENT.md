# Development Guide

Set up a local environment for feature work, debugging, and pre-release verification.

**Related:** [ARCHITECTURE.md](ARCHITECTURE.md) · [CODE_REFERENCE.md](CODE_REFERENCE.md) · [CI.md](CI.md) · [ERROR_HANDLING.md](ERROR_HANDLING.md)

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| Docker | For Postgres and optional full-stack runs |
| npm | Bundled with Node |

```bash
git clone <repository-url>
cd survey-builder
npm install
npm install --prefix server
cp .env.example .env
```

---

## Recommended workflow — API mode with hot reload

Best for everyday development. Vite and the API restart on file changes; Postgres runs in Docker.

```bash
npm run dev:docker
```

| Service | URL |
|---------|-----|
| Frontend (Vite) | http://localhost:5173 |
| API (Fastify) | http://localhost:3003 |
| Postgres | localhost:5433 |

`dev:docker` sets `VITE_USE_API=true` and starts Postgres via `docker-compose.dev.yml`.

### Default accounts (development seed)

| Account | Email / username | Password | Role |
|---------|------------------|----------|------|
| Org admin | `admin` or `admin@rescopesurveys.local` | `admin123` | admin |
| Platform owner | `vendor` or `vendor@rescopesurveys.local` | `vendor123` | platform_owner |

Seeded when `SEED_DEFAULT_ACCOUNTS=true` (development default).

### Manual Postgres control

```bash
npm run db:up
npm run db:reset
npm run db:migrate:dev --prefix server
npm run dev:all
```

---

## Alternative modes

### localStorage mode (no backend)

Fast UI-only work. Data stays in the browser.

```bash
npm run dev
```

Login: `admin` / `admin123` (localStorage, not Postgres).

### Full Docker stack (production-like)

Test the same images partners pull from Docker Hub.

```bash
docker compose up --build -d
open http://localhost:8080
```

Reset demo database:

```bash
docker compose down -v && docker compose up -d
```

### Docker dev override

Full stack with development API settings (seed, relaxed JWT, `COOKIE_SECURE=false`):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
```

---

## Compose file selection

| Task | Command |
|------|---------|
| Daily coding | `npm run dev:docker` |
| Test Hub images | `docker compose up -d` |
| Match production nginx path | `docker compose up --build -d` |
| Load testing | `./scripts/load/run-load-test.sh` |
| Production env testing | `docker compose -f docker-compose.yml -f docker-compose.prod.yml config` |

**Do not use `docker-compose.prod.yml` for daily dev** unless explicitly testing production env vars. It disables seed accounts and requires strong secrets.

---

## Verification before commit

```bash
npm run check:registries
node --test scripts/tests/unit/http-errors.test.mjs
npm run test:track-a
npm run test:config
npm run build
```

Integration tests require a running API:

```bash
npm run dev:docker
# separate terminal:
npm run test:rbac1
npm run test:security
```

Manual QA: [SMOKE_CHECKLIST.md](SMOKE_CHECKLIST.md).

---

## Environment variables (development)

See [.env.example](../.env.example). Minimum for API mode:

```bash
DATABASE_URL=postgresql://rescopesurveys:rescopesurveys@localhost:5433/rescopesurveys
JWT_SECRET=dev-secret-local-only-not-for-production
```

`npm run dev:docker` sets `VITE_USE_API=true` automatically.

---

## Path aliases

| Alias | Resolves to |
|-------|-------------|
| `@/` | `src/` |
| `@shared/` | `shared/` |

Vite dev server proxies `/api` → `http://127.0.0.1:3003`.

---

## Adding a question type

1. Add entry to `QUESTION_TYPES` in `src/utils/survey/questions/questionHelpers.js`
2. Add factory defaults in `src/store/factories.js`
3. Create builder editor in `src/components/builder/editors/` — register in `QuestionTypeEditor.jsx`
4. Create taker renderer in `src/components/taker/questions/` — register in `QuestionRenderer.jsx`
5. Add validation in `src/utils/survey/answerValidation.js` if needed
6. Add CSV formatting in `src/utils/csv/formatAnswer.js`
7. Run `npm run check:registries` — must pass

Full module reference: [CODE_REFERENCE.md](CODE_REFERENCE.md).
