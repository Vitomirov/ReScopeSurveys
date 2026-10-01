# Error Handling

How the API and SPA respond to failures — expected validation errors, auth/session expiry, database constraints, and unexpected bugs.

**Related:** [ARCHITECTURE.md](ARCHITECTURE.md) · [CODE_REFERENCE.md](CODE_REFERENCE.md) · [SECURITY_AUDIT.md](SECURITY_AUDIT.md)

---

## Design goals

| Goal | Approach |
|------|----------|
| **Safe in production** | Generic **500** bodies for unknown server faults; no stack traces or Prisma codes in JSON |
| **Predictable for clients** | Most JSON errors use `{ error: string, code?: string }` with stable HTTP status |
| **Fail closed on auth** | Invalid or revoked sessions return **401** with machine-readable `code` where needed |
| **No phantom state** | Token+email flows roll back DB tokens when SMTP fails; refresh does not clear cookies on infra errors |
| **Tenant privacy** | Missing or out-of-scope surveys return **404**, not **403** |

---

## API error shape

### JSON routes (typical)

Successful responses vary by endpoint. Errors usually look like:

```json
{ "error": "Human-readable message", "code": "OPTIONAL_CODE" }
```

`code` is included when the client should branch (auth, CSRF, billing gates). Prisma internal codes (`P2002`, etc.) are never exposed.

### Exceptions

| Surface | Format |
|---------|--------|
| `/api/internal/*` | Plain text (`OK`, `Forbidden`, …) for Caddy/nginx integrations |
| Unknown Fastify route | Fastify default 404 JSON (not the `{ error }` wrapper unless customized later) |
| `/health` | `{ ok, service, timestamp? }` — **503** when Postgres is unreachable |

---

## Backend

### Global handler

All unhandled exceptions in route handlers flow through Fastify’s `setErrorHandler` in `server/src/app.js`:

1. Log with `request.log.error(error)`
2. Shape the response with `publicErrorResponse(error, { isDev })` in `server/src/lib/httpErrors.js`
3. Send `{ error, code? }` with the resolved status

Route handlers normally **return** explicit `reply.code(...).send(...)` for expected failures (validation, RBAC, rate limits) instead of throwing.

### Database and infrastructure mapping

`mapDatabaseError()` in `httpErrors.js` translates Prisma errors before the response is built:

| Prisma / condition | HTTP | `code` (when set) | Client `error` (summary) |
|--------------------|------|-------------------|---------------------------|
| **P2002** unique constraint | 409 | `CONFLICT` | Email / username / generic “already in use” (from constraint target) |
| **P2025** record not found | 404 | `NOT_FOUND` | Record not found |
| **P2034** transaction conflict | 409 | `TRANSACTION_CONFLICT` | Request conflict — retry |
| **P1001, P2024**, … (see source) | 503 | `DB_UNAVAILABLE` | Service temporarily unavailable |
| Initialization / rust panic | 503 | `DB_UNAVAILABLE` | Same |

In **production**, unmapped **500** responses use `"Internal server error"` only. Mapped **503** responses keep the safe availability message (not downgraded to generic 500).

Other framework cases:

| Condition | HTTP |
|-----------|------|
| Request body over 2 MiB | 413 — Payload too large |

### Route-level patterns (selected)

| Area | Behavior |
|------|----------|
| **Survey access** | `findAccessibleSurvey()` → **404** if missing or outside `surveyScope()` |
| **Public taker** | Inactive org or non-live survey → **404** (no leak of billing state) |
| **Response submit** | `upsertResponse()` + `sendUpsertResult()` → **400** / **409** with specific copy |
| **Survey PATCH** | Optimistic `revision` → **409** `Revision conflict` + current `revision` |
| **Rate limits** | **429** + `RateLimit-*` / `Retry-After` headers |
| **CSRF** | **403** + `code: CSRF_BLOCKED` |

### Auth and session

| Endpoint / hook | Notes |
|-----------------|-------|
| `onRequest` auth (`plugins/auth.js`) | **401** + `TOKEN_EXPIRED`, `UNAUTHORIZED`, or `SESSION_INVALID` |
| `POST /api/auth/refresh` | Only `RefreshTokenError` → **401** and cookies cleared; DB/infra errors **rethrow** → global handler (**503**/**500**), cookies **kept** |
| Token link flows (invite, reset, verify) | `AuthTokenError` → **400** + `INVALID_TOKEN` in route `catch`; other errors → global handler |

### Email + one-time tokens

`server/src/lib/auth/accountLinks.js` is the only module that pairs `issueAuthToken` with outbound mail:

1. Create token row (voiding older pending tokens for that type + email)
2. Send via `app.mailer`
3. On send failure → `voidPendingTokens()` for that type + email, then rethrow (HTTP error, no success body)

Applies to verification, password reset, and team invites (including resend). Signup still creates the account if verification email fails; the user can use **Resend verification**.

### Health

`GET /health` runs `SELECT 1`. Success → **200** `{ ok: true, ... }`. DB failure → **503** `{ ok: false, service }`.

---

## Frontend

Dual mode: **localStorage** (offline demo) vs **API** (`VITE_USE_API=true`). Error UX is richest in API mode.

### HTTP client

`src/api/client.js` — `apiFetch()`:

- Parses JSON errors into **`ApiError`** (`message`, `status`, `body`)
- **401** on protected routes: attempts cookie refresh once, then `notifyAuthInvalidated()` → logout toast
- Attaches CSRF header on mutating requests when using cookies

### UI recovery

| Layer | Module | Role |
|-------|--------|------|
| Route shell | `ErrorBoundary` in `App.jsx` | Catches render errors — Try again / Reload |
| Builder saves | `useAutosave` | **409** revision → refetch + hydrate; shows save status in header |
| Dashboard / settings | Panel `catch` | Toasts with `err.message` or copy from `*Copy.js` constants |
| Public taker | `SurveyPreview` | Validation errors inline; failed response POST currently logs to console only (known gap) |

See [CODE_REFERENCE.md — Error boundaries](CODE_REFERENCE.md#error-boundaries) for wrapped surfaces.

### Load failures

`App.jsx` maps survey fetch **404** to “Survey not found”. Other fetch errors on the builder show the same not-found style; the public taker path treats any non-ready state as not found (operational improvement deferred).

---

## Auth and API `code` values (reference)

Common values the SPA or integrators may see:

| `code` | Typical HTTP | Meaning |
|--------|--------------|---------|
| `UNAUTHORIZED` | 401 | No or invalid access token |
| `TOKEN_EXPIRED` | 401 | Access expired; refresh may succeed |
| `SESSION_INVALID` | 401 | User revoked, role change, or token version mismatch |
| `FORBIDDEN` | 403 | Role or plan gate |
| `CSRF_BLOCKED` | 403 | Origin or CSRF token check failed |
| `EMAIL_UNVERIFIED` | 403 | Admin must verify email before invites |
| `INVALID_TOKEN` | 400 | One-time link invalid or expired |
| `CONFLICT` | 409 | Unique constraint (including race after check-then-act) |
| `DB_UNAVAILABLE` | 503 | Database unreachable or pool timeout |

---

## Verification

### Unit tests

```bash
node --test scripts/tests/unit/http-errors.test.mjs
```

Covers Prisma mapping and production masking for generic 500 vs 503.

### Integration suites

Security and auth integration tests assert refresh rotation, rate-limit error bodies, and revision **409** behavior (require API + Postgres — see [DEVELOPMENT.md](DEVELOPMENT.md)):

```bash
npm run test:security
npm run test:track-a
```

---

## Gaps and roadmap

Centralized error mapping does **not** replace observability. Production still relies on Fastify/Pino logs on the VPS ([OPERATIONS.md](OPERATIONS.md)). Structured audit logging and external APM are tracked in [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

When adding a route:

1. Prefer explicit `reply.code().send({ error, code? })` for expected failures
2. Throw only when reusing global mapping (or let Prisma throw for rare races)
3. Do not expose internal exception text on **500** in production
4. For new client branches, add a stable `code` string consistent with the table above
