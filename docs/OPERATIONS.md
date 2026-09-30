# Operations & Maintenance

Day-2 guide for platform operators — updates, backups, enterprise customers, monitoring, and troubleshooting.

**Related:** [DEPLOY.md](DEPLOY.md) (first deploy) · [ARCHITECTURE.md](ARCHITECTURE.md) (design) · [SECURITY_CONTROLS.md](SECURITY_CONTROLS.md) · [SECURITY_ROADMAP.md](SECURITY_ROADMAP.md)

---

## Daily operations

### Check service health

```bash
cd /opt/rescopesurveys
docker compose ps
curl -s http://127.0.0.1:8080/health
./scripts/deploy/verify.sh
```

### View logs

```bash
docker compose logs -f api          # API errors, migrations, rate limits
docker compose logs -f web          # nginx access
sudo journalctl -u caddy -n 50      # TLS / certificate issues
```



### Restart application (no image change)

```bash
docker compose restart api web
```

Recreate API after `.env` changes (restart alone does not reload environment):

```bash
docker compose up -d --force-recreate api
```

---



## Releases and rollback



### Standard update

**Workstation:**

```bash
./scripts/deploy/publish-docker.sh v0.1.1
./scripts/deploy/sync-to-vps.sh root@VPS_IP   # if compose/scripts changed
```

**VPS:**

```bash
cd /opt/rescopesurveys
./scripts/deploy/deploy.sh v0.1.1
./scripts/deploy/verify.sh
```

`deploy.sh` updates `IMAGE_TAG` in `.env`, pulls images, and restarts containers.

### Rollback

```bash
./scripts/deploy/deploy.sh v0.1.0
```

**Warning:** image rollback does not reverse Prisma migrations. If a release included a destructive migration, restore a database dump first, then deploy the older image.

### Caddy reload (domain or TLS config change)

```bash
sudo cp /opt/rescopesurveys/docker/caddy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---



## Backups and restore



### Manual backup

```bash
./scripts/deploy/backup.sh
```

Output: `/opt/backups/rescopesurveys-YYYY-MM-DD-HHMM.sql.gz`

### Scheduled backups

```bash
./scripts/deploy/backup.sh --install-cron
```



### Off-host copy (required for production)

Use a dedicated SSH account on a second host. Add this to
`/opt/rescopesurveys/.env`:

```bash
OFFSITE_BACKUP_TARGET=backupuser@backup.example:/srv/rescopesurveys
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/REPLACE/ME
```

Run and prove a copy exists:

```bash
cd /opt/rescopesurveys
./scripts/deploy/backup.sh
ssh backupuser@backup.example \
  'ls -lh /srv/rescopesurveys/rescopesurveys-*.sql.gz'
```

The script exits non-zero if the dump or rsync copy fails and sends a webhook
notification when configured. Restrict the backup account to its destination.
S0 copies are not encrypted by this script; encrypted off-host backups remain
an S3 roadmap control.

### Restore drill (throwaway database)

Never test a restore over production. Run this before first paid fieldwork and
at least quarterly:

```bash
cd /opt/rescopesurveys
DUMP=/opt/backups/rescopesurveys-2026-09-09-0300.sql.gz
POSTGRES_USER="$(sed -n 's/^POSTGRES_USER=//p' .env)"

docker compose exec -T postgres \
  createdb -U "${POSTGRES_USER:-rescopesurveys}" rescope_restore_drill
gunzip -c "$DUMP" | docker compose exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-rescopesurveys}" \
  -d rescope_restore_drill
docker compose exec -T postgres \
  psql -U "${POSTGRES_USER:-rescopesurveys}" -d rescope_restore_drill \
  -c 'SELECT count(*) AS organizations FROM organizations;' \
  -c 'SELECT count(*) AS surveys FROM surveys;' \
  -c 'SELECT count(*) AS responses FROM responses;'
docker compose exec -T postgres \
  dropdb -U "${POSTGRES_USER:-rescopesurveys}" rescope_restore_drill
```

Record the date, dump filename, row counts, operator, and result. Success
requires `psql` to exit zero and plausible counts. To test the off-host copy,
rsync that dump back into `/opt/backups/` first.

---



## Enterprise customers (hosted SaaS)

Enterprise is a **subscription tier** on your multi-tenant platform, not a separate deployment.

### What Enterprise includes


| Feature              | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| Custom survey domain | Public URLs on `surveys.client.com` after DNS verification |
| Brand lock           | Enforce org brand defaults in survey editor                |
| 100 seats            | Higher team limit                                          |
| Unlimited surveys    | No survey count cap                                        |




### Platform owner workflow

1. Log in as `platform_owner` (vendor account in development; create manually in production or seed once in a controlled setup).
2. Open **Platform Console** (automatic redirect for `platform_owner` role).
3. Select the customer's organization.
4. Set **Plan** → `Enterprise`, **Status** → `active`.
5. Enter **Survey domain** → e.g. `client.com`.
6. Click **Save subscription**.
7. Optionally create an invoice.



### Customer admin workflow (after you upgrade them)

1. Open billing → **Custom domain verification**.
2. Click **Initialize** — receive TXT record instructions.
3. Add `_rescope-verify.client.com` TXT at their DNS provider.
4. Add `A` record: `surveys.client.com` → your VPS IP.
5. Click **Check DNS** until status is `verified`.
6. Shareable survey URLs now use `https://surveys.client.com/{publicPath}`.

Caddy issues on-demand TLS certificates only for domains verified in the database (`/api/internal/caddy-ask`).

### Self-hosted enterprise

A customer who runs Docker on their own server gets the full stack with their own database. Plan enforcement still exists in the app, but there is no connection to your SaaS billing. Typical handoff:

- Contract + support agreement
- Pinned Docker image tag
- `docker-compose.yml` + `docker-compose.prod.yml` + deploy docs
- Customer manages DNS, secrets, backups, and upgrades

---



## Subscription management (all plans)


| Plan           | Seats | Surveys   | Notable features                 |
| -------------- | ----- | --------- | -------------------------------- |
| `free_trial`   | 1     | 5         | 14-day trial                     |
| `starter`      | 5     | Unlimited | Base paid tier                   |
| `professional` | 25    | Unlimited | Brand Kit, embeds, hide branding |
| `enterprise`   | 100   | Unlimited | Custom domain, brand lock        |


Plans are assigned manually via Platform Console. Self-service checkout is not implemented.

Inactive statuses (`canceled`, `past_due`, expired trial) block authoring and public survey delivery.

---



## Monitoring



### Resource usage

```bash
docker stats --no-stream
free -h
df -h
```

Watch during peak traffic:

- API container CPU consistently above 150% of one core
- Memory above ~3.2 GB on a 4 GB VPS
- Postgres restarts or OOM kills



### Health endpoints


| URL                                 | Purpose                     |
| ----------------------------------- | --------------------------- |
| `http://127.0.0.1:8080/health`      | Stack health (loopback)     |
| `https://app.yourdomain.com/health` | Public health through Caddy |




### S0 alerts (cron + webhook)

Set `ALERT_WEBHOOK_URL` in `.env` to a Slack-compatible webhook, then install:

```bash
(crontab -l 2>/dev/null; echo '*/5 * * * * /opt/rescopesurveys/scripts/deploy/monitor.sh >> /opt/backups/monitor.log 2>&1') | crontab -
```

This alerts when `/health` is down, the newest dump is older than 25 hours, or
at least 20 nginx responses are 429/5xx within five minutes. Override with
`ERROR_THRESHOLD`, `ERROR_WINDOW`, and `BACKUP_MAX_AGE_HOURS`.

Test delivery immediately:

```bash
cd /opt/rescopesurveys
HEALTH_URL=http://127.0.0.1:1/health \
BACKUP_MAX_AGE_HOURS=999999 ./scripts/deploy/monitor.sh
```

Expected: non-zero exit and an API-health notification within five minutes.
During active fieldwork, acknowledge API-down alerts within 15 minutes and
begin recovery immediately. Failed webhook delivery is visible in
`/opt/backups/monitor.log`.

Also monitor certificate expiry, disk above 80%, and unhealthy containers.

### Privileged MFA rollout and recovery

MFA enrollment is gradual: existing `admin` and `platform_owner` sessions keep
working until each user enrolls from **My account → Two-factor
authentication**. Add a stable key to an existing production `.env` and
recreate the API:

```bash
printf '\nMFA_ENCRYPTION_KEY=%s\n' "$(openssl rand -base64 48 | tr -d '\n')" >> .env
chmod 600 .env
docker compose up -d --force-recreate api
```

Store this key off the VPS. Losing or rotating it makes enrolled TOTP secrets
unreadable. Each user must save the one-time recovery codes shown at enrollment.

If a privileged user loses both authenticator and codes, verify identity and
disable MFA from the VPS:

```bash
docker compose exec -T postgres psql -U rescopesurveys -d rescopesurveys \
  -c "UPDATE users SET mfa_enabled=false, mfa_secret=NULL, \
mfa_recovery_codes=ARRAY[]::TEXT[], user_token_version=user_token_version+1 \
WHERE user_email='verified-user@example.com';"
docker compose restart api
```

Record this as a security incident; the user must sign in and enroll again.

---



## Capacity planning

The project includes k6 load tests modeling a **2 vCPU / 4 GB** deployment:

```bash
./scripts/load/run-load-test.sh --quick    # ~1 min smoke
./scripts/load/run-load-test.sh            # full ramp to 200 VUs
```

Results: `k6/results/summary.json`

**Design target (if test passes at 200 VUs):**

- ~150–200 concurrent survey respondents
- ~30–40 concurrent dashboard users
- p95 API latency under 800 ms

Production adds Caddy TLS overhead and rate limiting. Do not run full load tests against a live tenant-facing server from a single IP — rate limits will trigger 429 responses.

Upgrade path: larger VPS (CX32), or separate database host for heavy workloads.

---



## Troubleshooting



### Certificate errors

```bash
./scripts/deploy/check-dns.sh
sudo journalctl -u caddy -n 100 --no-pager
```

Common causes: DNS still on parking page, missing `surveys` A record, port 80 blocked, Let's Encrypt rate limit after repeated failures.

### 502 Bad Gateway from Caddy

```bash
docker compose ps
curl http://127.0.0.1:8080/health
sudo ss -tlnp | grep 8080
docker compose logs --tail 50 web api
```

Ensure `WEB_HOST_PORT` in `.env` matches `127.0.0.1:8080` in the Caddyfile.

### Login works, session lost on reload

Production sets `COOKIE_SECURE=true`. Access the app over valid HTTPS only. Do not disable secure cookies.

### API restart loop

```bash
docker compose logs --tail 100 api
```

Typical causes: placeholder `JWT_SECRET`, `POSTGRES_PASSWORD` mismatch with existing `pgdata` volume, missing `REDIS_URL` / `INTERNAL_API_SECRET` in production compose.

### Port 8080 publicly reachable

Requires Docker Compose v2.24+ for `ports: !override`. Verify:

```bash
docker compose version
sudo ss -tlnp | grep 8080   # should show 127.0.0.1 only
```



### `surveys.yourdomain.com/path` shows dashboard

Hostname must be exactly `surveys.yourdomain.com`. Survey must be `live` with matching `publicPath`.

```bash
curl https://surveys.yourdomain.com/api/public/surveys/<publicPath>
```



### Docker permission denied

After bootstrap as non-root: `newgrp docker` or reconnect SSH.

### Database password change

You cannot change `POSTGRES_PASSWORD` in `.env` without recreating the volume or running `ALTER USER` inside Postgres. Plan passwords before first `docker compose up`.

---



## Security maintenance

- Apply Ubuntu security updates; reboot when kernel updates require it
- Rotate `JWT_SECRET` only with a planned session invalidation (all users must re-login)
- Review [SECURITY_ROADMAP.md](SECURITY_ROADMAP.md) for your usage stage before onboarding regulated or Enterprise customers
- Never commit `.env`, backup files, or secrets to git

---



## Quick reference


| Task          | Command                                                  |
| ------------- | -------------------------------------------------------- |
| Deploy update | `./scripts/deploy/deploy.sh v0.1.1`                      |
| Status        | `docker compose ps`                                      |
| API logs      | `docker compose logs -f api`                             |
| Health check  | `./scripts/deploy/verify.sh`                             |
| DNS check     | `./scripts/deploy/check-dns.sh`                          |
| Backup now    | `./scripts/deploy/backup.sh`                             |
| Reload Caddy  | `sudo systemctl reload caddy`                            |
| Stop stack    | `docker compose down` (data retained in `pgdata` volume) |


