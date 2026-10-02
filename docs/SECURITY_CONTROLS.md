# Security controls (production)

Layers **already intended for production** in Rescope Surveys. For planned work, see [SECURITY_ROADMAP.md](SECURITY_ROADMAP.md). For a full posture review, see [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

---

## Transport hardening (HSTS)

| | |
|---|---|
| **What** | Host Caddy sends `Strict-Transport-Security: max-age=63072000; includeSubDomains` on HTTPS responses for production site blocks and verified enterprise survey hosts (`docker/caddy/Caddyfile`, `(browser_security)` snippet). |
| **Why** | TLS terminates at Caddy; browsers should treat HTTPS as mandatory for those hostnames after the first successful visit. |
| **Prevents** | SSL stripping and accidental downgrade to plain HTTP (e.g. user clicks `http://` links); reduces exposure of session cookies on insecure transport when combined with `Secure` cookies. |
| **Does not prevent** | Attacks on first visit before HSTS is cached; mis-issued certificates; compromise of the origin server; attacks that already run over HTTPS (XSS, CSRF if misconfigured). Does not replace correct DNS and certificate management. |
