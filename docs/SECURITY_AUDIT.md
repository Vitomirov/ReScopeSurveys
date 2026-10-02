# Rescope Surveys — Security Posture & Audit

**Last updated:** 2026-09-07  
**Product:** Rescope Surveys (Survey SaaS)  
**Scope:** React SPA, Fastify API, Prisma/PostgreSQL, Docker/nginx/Caddy deployment, CI/CD  
**Method:** Static code and configuration review, dependency audit (`npm audit --omit=dev`), integration test execution. Not a penetration test, dynamic scan, or compliance certification.

---

## 1. Executive summary

Rescope Surveys has a **solid baseline** for an early-stage B2B survey platform: organization-scoped data access, HttpOnly cookie sessions with rotating refresh tokens, server-side HTML sanitization, parameterized database access, production network isolation, and a growing automated security test suite.

**Phases 0–3 are implemented** in the application and production Compose stack (see §3). The original critical JWT/Fastify advisories are remediated; cookie-authenticated mutations are CSRF-protected; distributed rate limiting runs on private Redis; embed framing and proxy trust boundaries are materially improved.

The platform is **not yet enterprise-ready**. Highest residual risks are incomplete public-response schema validation, absence of MFA/audit logging/data-governance controls, limited container and CI/CD assurance, and operational dependencies (DNS, `CORS_ORIGIN`, secrets) that must be configured correctly on every VPS.

| Area | Status |
|------|--------|
| Authentication & session hygiene | **Good baseline** — short-lived JWT, refresh rotation, HS256 |
| Tenant isolation (application layer) | **Good baseline** — consistent org/survey scoping |
| CSRF, embed framing, proxy trust | **Implemented** (Phase 3) |
| Abuse protection | **Implemented** in-app (Phase 2); edge WAF deferred |
| Public response integrity | **Gap** — structural validation only |
| Identity lifecycle (MFA, SSO, recovery) | **Gap** |
| Audit logging & monitoring | **Gap** |
| Data governance & encryption | **Gap** |
| Container / supply-chain hardening | **Gap** |
| CI/CD security gates | **Partial** |

**Overall posture:** suitable for controlled production use with operator diligence; **additional P1 work required** before marketing to regulated or large enterprise customers.

---

## 2. Implementation roadmap

### Completed

| Phase | Focus | Outcome |
|-------|--------|---------|
| **0** | Baseline & preflight | Regression suites documented; production backup/smoke checklist defined |
| **1** | Dependencies & config | `@fastify/jwt` 10.x, Fastify 5.x, HS256-only JWTs, strict prod config, required `POSTGRES_PASSWORD` / strong `JWT_SECRET` |
| **2** | Distributed rate limits | Private Redis; per-IP, per-account, global auth, and per-survey quotas; hashed keys; `Retry-After` headers; in-memory fallback |
| **3** | Application security (P0) | CSRF (`Origin` + `rs_csrf`); refresh cookie path `/api/auth`; CSP `frame-ancestors` on HTML; per-survey embed CSP; validated `postMessage` origins; `INTERNAL_API_SECRET` for Caddy ask; trusted `X-Forwarded-Host` overwrite; Caddy ask rate limits |
| **12** | Account lifecycle | Email verification for self-signup admins; invite-only team onboarding (no admin-set passwords); self-service password reset; single-use hashed tokens; mandatory SMTP in production |

### Remaining

| Phase | Priority | Focus |
|-------|----------|--------|
| **2.1** | P2 | Rate-limit tuning for enterprise NAT (shared-office IP quotas) |
| **4** | P1 | Authoritative JSON schemas; security audit log; MFA (TOTP) for admins; data governance & fingerprinting controls |
| **5** | P2 | Container hardening; CI/CD security gates; monitoring & alerting; PostgreSQL RLS evaluation |
| **6** | P3 | Browser/upload polish (CSP reporting); host SSH hardening; penetration test; `SECURITY.md` |

---

## 3. Implemented controls

### 3.1 Authentication & sessions

- **HttpOnly cookies:** `rs_access` (JWT) and `rs_refresh` (rotating opaque token); production `Secure` + `SameSite=Lax`.
- **Short-lived access tokens:** default 15 minutes; refresh ~30 days with rotation on each use.
- **Refresh-token security:** 256-bit random values, SHA-256 hashed at rest, family revocation on reuse detection.
- **Session revocation:** JWT `tokenVersion` incremented on password change; refresh families revoked; deleted users invalidated.
- **Live authorization:** role and organization reloaded from PostgreSQL (2-second cache TTL on user row).
- **Password storage:** bcrypt (cost 10); generic auth failure messages.
- **CSRF (Phase 3):** unsafe cookie-authenticated `/api` methods require allowlisted `Origin` / `Sec-Fetch-Site` plus double-submit `rs_csrf` / `X-CSRF-Token`. Login/signup and `/api/public/*` exempt.
- **CORS:** production requires explicit origin allowlist; wildcards rejected. **`CORS_ORIGIN` must include every app host** (e.g. `https://app.rescopesurveys.com`).
- **Account lifecycle (Phase 12):** one-time links for invites (7 days), password reset (1 hour), and email confirmation (48 hours). Tokens are 256-bit random, stored as SHA-256 hashes, single-use (atomic claim), and re-issuing voids earlier links. Tokens travel in the URL fragment so they never reach server logs. `POST /api/auth/password/forgot` always returns 200 (no account enumeration). Reset increments `tokenVersion` and revokes all refresh families. Admins invite by email + role only — they never see or set a member's password; acceptance creates the user inside the inviting org with a verified email and enforces seat limits. Unverified admins cannot invite. Outbound mail via SMTP is **required** in production (`EMAIL_TRANSPORT=log` is rejected).

*References:* `server/src/lib/auth/cookies.js`, `server/src/lib/security/csrf.js`, `server/src/plugins/csrf.js`, `server/src/plugins/auth.js`, `server/src/lib/auth/authTokens.js`, `server/src/lib/auth/accountLinks.js`, `server/src/routes/invites.js`, `server/src/routes/passwordReset.js`, `server/src/routes/emailVerification.js`, `src/api/client.js`

### 3.2 Authorization & tenant isolation

- **Organization scope** on dashboard, billing, platform lists, responses, exports, and surveys.
- **Survey scope:** admins see org surveys; editors see own surveys; inaccessible surveys return **404** (no existence leak).
- **Vendor isolation:** `platform_owner` required for cross-tenant vendor routes.
- **Atomic sensitive writes:** signup transaction; password change + token revocation in one transaction.
- **Public reads:** live surveys only; inactive subscriptions rejected.

*References:* `server/src/lib/auth/authz.js`, `server/src/lib/auth/surveyAccess.js`, `server/src/routes/public.js`

### 3.3 Input handling & XSS

- **Survey HTML sanitization** on write (`isomorphic-dompurify`, restricted tags/attributes).
- **Defense in depth** on render: editor paste sanitization + pre-render sanitization for `dangerouslySetInnerHTML`.
- **Response validation (partial):** UUID IDs, allowlisted statuses, known question keys, cross-survey ID blocking, basic completion checks, server-side DNC resolution.
- **External redirects:** HTTP/HTTPS only; `noopener,noreferrer`.
- **Request body limit:** 2 MiB; generic production error messages.

*References:* `server/src/lib/survey/sanitizeHtml.js`, `server/src/routes/responses.js`, `server/src/lib/survey/completeValidation.js`

### 3.4 Abuse protection (Phase 2)

- **Redis-backed counters** shared across API replicas (`RATE_LIMIT_REDIS_REQUIRED=true` in production).
- **Layered limits:** per-IP; per-account (login); global auth ceilings; per-survey public fetch/DNC/submit.
- **Opaque rate-limit keys** (SHA-256 hashed identifiers).
- **Standard `Retry-After` and quota headers** on throttle responses.
- **Degraded mode:** bounded in-memory limiter if Redis fails at runtime (API stays up).

*References:* `server/src/lib/survey/rateLimit.js`, `server/src/plugins/rateLimits.js`, `docker-compose.prod.yml`

### 3.5 Embed & framing (Phase 3)

- **Default SPA:** `frame-ancestors 'none'` on nginx HTML responses.
- **Embed routes:** nginx `auth_request` to `/api/internal/embed-csp` sets per-survey `frame-ancestors` from org allowlist.
- **`postMessage`:** targets validated parent origin only (no `*`).
- **Public branding payload** includes `embedAllowedOrigins` for embed mode.

*References:* `docker/nginx.conf`, `server/src/routes/internal.js`, `shared/embedProtocol.js`, `src/hooks/useEmbedMessaging.js`

### 3.6 Proxy, host trust & internal routes (Phase 3)

- **nginx/Caddy** overwrite `X-Forwarded-Host` from validated host.
- **`clientDomainFromRequest`** uses framework hostname; dev-only `?client=` query fallback.
- **`INTERNAL_API_SECRET` required** in production for `/api/internal/caddy-ask` (passed via Caddy systemd override).
- **Caddy ask** rate-limited; domain allowlist + DNS TXT verification for enterprise hosts.

*References:* `docker/nginx.conf`, `docker/caddy/Caddyfile`, `server/src/routes/internal.js`, `server/src/lib/survey/surveyPublicPath.js`

- **HSTS:** host Caddy `(browser_security)` sends `Strict-Transport-Security` with two-year `max-age` and `includeSubDomains` (no preload). Documented in [SECURITY_CONTROLS.md](SECURITY_CONTROLS.md).

### 3.7 Infrastructure & deployment

- **Network:** PostgreSQL and API not published publicly; web on `127.0.0.1` only; Caddy terminates TLS.
- **Secrets:** `init-env.sh` generates JWT/DB secrets; `.env` mode 600; deploy validation rejects placeholders.
- **Production override:** no seed accounts, no dev migrations, no Bearer auth, strict JWT, Redis required.
- **Backups:** nightly `pg_dump` script with retention (operator must copy off-host).
- **DNS:** four A records required — `@`, `www`, `app`, **`surveys`** (public respondent links).

*References:* `docs/DEPLOY.md`, `docker-compose.prod.yml`, `scripts/deploy/`

### 3.8 Automated verification

Integration tests cover RBAC, survey/response ownership, auth cookies & refresh, account lifecycle (`npm run test:auth-lifecycle`: verification, invites, reset, single-use tokens, no account enumeration), CSRF, rate limits, revision conflicts, XSS sanitization, and config validation under `scripts/tests/`.

**Production operator checklist (after each security-related deploy):**

1. `CORS_ORIGIN` includes all app/survey hosts (no spaces after commas).
2. `INTERNAL_API_SECRET` in `.env` **and** Caddy systemd override (same value).
2b. `SMTP_URL` set and a test invite / reset email actually arrives (check spam; SPF/DKIM for `EMAIL_FROM` domain).
3. Recreate API after `.env` changes: `docker compose … up -d --force-recreate api` (`restart` does not reload env).
4. `./scripts/deploy/check-dns.sh` passes for all four hostnames.
5. Run smoke checklist in `docs/DEPLOY.md` §7.

---

## 4. Open findings & residual risk

Findings below are **still open** or **partially mitigated**. Resolved items from the original audit (JWT CVEs, CSRF, embed CSP, Redis rate limits, proxy host overwrite, internal secret) are omitted here.

### P1 — High priority

#### 4.1 Public response validation is incomplete

The API validates IDs, statuses, and basic completion but not full per-question answer schemas (types, bounds, option membership, matrix IDs, visibility/branch state, trusted timestamps, fingerprint structure). Forged payloads can corrupt analytics or store excess PII.

**Recommendation:** versioned JSON schemas per question type; server-side completion/termination evaluation; reject unknown properties; trusted metadata only from server.

#### 4.2 Remaining identity controls

Email verification, invite-only onboarding, and self-service password reset shipped in Phase 12 (see §3.1). Still open: MFA, SSO, breached-password screening, session inventory ("sign out everywhere" UI), and the legacy admin `POST /api/platform/users` endpoint that sets a member password directly (kept for test fixtures; the UI no longer uses it in API mode). Signup remains open; minimum password length is 8 characters.

**Recommendation:** TOTP MFA for `admin` and `platform_owner`; HIBP k-anonymity check on signup/reset; retire `POST /api/platform/users` once fixtures use invites; absolute + idle session limits; SSO (OIDC/SAML) for the enterprise tier.

#### 4.3 No security audit trail

No durable record of logins, failed auth, role changes, exports, deletions, survey publication, billing/domain changes, or vendor cross-tenant actions.

**Recommendation:** append-only, tenant-aware audit events; off-host shipping; alerts on high-risk actions; never log secrets or raw tokens.

#### 4.4 Data governance gaps

No application-level encryption, automated encrypted off-host backups, retention/deletion workflows, or documented subprocessor/consent controls. Optional fingerprinting can call third-party IP APIs (`ipapi.co`, `ipify`) without in-product consent.

**Recommendation:** classify data; encrypt volumes/backups; minimize/disable third-party fingerprint lookups by default; tenant disclosures and retention policies.

### P2 — Medium priority

#### 4.5 Edge and bot controls (Phase 2 remainder)

In-app Redis limits are live; CDN/WAF, bot scoring, CAPTCHA, and provider alerting are not configured in code.

**Recommendation:** Cloudflare or similar in front of public survey hosts; alert on 429/403 spikes; tune quotas from production traffic (Phase 2.1 for NAT).

#### 4.6 Internal routes still reachable via nginx proxy

`/api/internal/*` bypasses user authentication. Production requires `INTERNAL_API_SECRET` for Caddy ask, but routes remain proxied through the public web stack. Embed-CSP subrequest is internal to nginx.

**Recommendation:** bind internal listener on loopback only or block `/api/internal/` at nginx for external clients.

#### 4.7 DNC check is a membership oracle

Public DNC check reveals whether an email is on a survey suppression list.

**Recommendation:** bind to signed respondent token or return generic flow outcomes only.

#### 4.8 Partial response takeover if UUID leaks

A known partial-response UUID allows unauthenticated overwrite.

**Recommendation:** server-issued write capability or signed respondent session.

#### 4.9 Role cache staleness (~2 s)

Privileged revocations may lag by up to two seconds on cached user rows.

**Recommendation:** bypass cache for vendor, export, billing, and destructive routes; or document accepted window.

#### 4.10 Container & image hardening

API image includes build tooling; containers run as default user; no read-only root, capability drops, or resource limits; tags not pinned by digest.

**Recommendation:** multi-stage images, non-root, Trivy/Grype in CI, deploy by digest.

#### 4.11 CI/CD security gates incomplete

CI builds images and runs unit/config tests; full auth/RBAC/security integration suite not gated on every PR; no SAST, secret scan, or SBOM enforcement; CD auto-deploys on `main`.

**Recommendation:** PostgreSQL + API integration job; `npm audit`/OSV policy; CodeQL; Gitleaks; production approval gate.

#### 4.12 Monitoring & incident readiness

No centralized logs, auth/abuse alerts, backup-failure alerts, or published incident runbook / `SECURITY.md`.

**Recommendation:** structured logs, metrics, synthetic checks, on-call runbooks.

#### 4.13 No database-level tenant backstop

Tenant isolation is application-enforced only; PostgreSQL RLS not enabled.

**Recommendation:** evaluate RLS with transaction-scoped `organizationId`; composite FK constraints; negative cross-tenant tests.

### P3 — Lower priority / defense in depth

- **CSP polish:** remove remaining inline handlers in `index.html` (font loader); CSP reporting, narrower image hosts.
- **Upload validation:** magic-byte checks for avatars/logos; dedicated asset origin.
- **Public anti-automation:** signed collector links, optional bot challenges, deduplication rules.
- **Local/demo mode:** plaintext storage in browser — must never ship with `VITE_USE_API=false` in production builds.
- **Prisma CLI advisory:** high-severity `deepmerge-ts` in migration tooling only; plan Prisma 7 migration separately.
- **Host hardening:** key-only SSH, disable root login, fail2ban, automated patching.
- **Penetration test** before enterprise launch and after major auth/data-flow changes.

---

## 5. Prioritized backlog (summary)

| # | Item | Priority | Status |
|---|------|----------|--------|
| 1 | JWT/Fastify dependency upgrades | P0 | **Done** (Phase 1) |
| 2 | CSRF + Origin enforcement | P0 | **Done** (Phase 3) |
| 3 | Embed `frame-ancestors` on HTML + safe `postMessage` | P0 | **Done** (Phase 3) |
| 4 | Redis distributed rate limiting | P0 | **Done** (Phase 2) |
| 5 | Proxy/host trust + `INTERNAL_API_SECRET` | P0 | **Done** (Phase 3) |
| 6 | Authoritative response/survey schemas | P1 | Open |
| 7 | Security audit logging | P1 | Open |
| 8 | MFA & account lifecycle | P1 | Open |
| 9 | Data governance & fingerprinting controls | P1 | Open |
| 10 | Edge WAF / bot controls | P2 | Open |
| 11 | Internal route network isolation | P2 | Partial |
| 12 | Container & supply-chain hardening | P2 | Open |
| 13 | CI/CD security gates | P2 | Partial |
| 14 | Monitoring & incident readiness | P2 | Open |
| 15 | PostgreSQL RLS evaluation | P2 | Open |
| 16 | Enterprise NAT rate-limit tuning | P2 | Deferred (2.1) |
| 17 | Browser/upload polish, pen test | P3 | Open |

---

## 6. Dependency & verification record

| Check | Result (2026-09-07) |
|-------|---------------------|
| Frontend `npm audit --omit=dev` | 0 vulnerabilities |
| Backend JWT/Fastify advisories | Remediated (Phase 1) |
| Backend Prisma CLI transitive | 1 high (`deepmerge-ts`) — tooling only |
| Auth, RBAC, CSRF, rate-limit integration tests | Passing |
| Production Compose (API + Redis + nginx) | Healthy in isolated validation |
| Production VPS smoke | Operator-verified: app login, survey save, public link on `surveys.*` (DNS propagation dependent) |

---

## 7. Document maintenance

Update this file when:

- A roadmap phase ships to production.
- A new material finding is discovered or closed.
- Production architecture changes (new subdomains, proxy layers, auth methods).
- A penetration test or compliance review produces actionable results.

For deployment steps tied to security configuration, see `docs/DEPLOY.md`. For day-one smoke checks, see `docs/SMOKE_CHECKLIST.md`.
