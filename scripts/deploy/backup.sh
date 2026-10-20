#!/usr/bin/env bash
# Dump Postgres from the running stack. Optionally install a nightly cron job.
#
# Usage (on the VPS, from /opt/rescopesurveys):
#   ./scripts/deploy/backup.sh
#   ./scripts/deploy/backup.sh --install-cron
#   ./scripts/deploy/backup.sh --dry-run
#
# OFFSITE_BACKUP_TARGET=user@host:/path copies the dump with rsync.
# ALERT_WEBHOOK_URL receives a JSON notice when the dump or copy fails.
# Full guide: docs/OPERATIONS.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

cd "$ROOT"

BACKUP_DIR="${BACKUP_DIR:-/opt/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

install_cron() {
  local line
  sudo_cmd mkdir -p "$BACKUP_DIR"
  sudo_cmd chmod 700 "$BACKUP_DIR"
  line="0 3 * * * $SCRIPT_DIR/backup.sh >> $BACKUP_DIR/backup.log 2>&1"
  if crontab -l 2>/dev/null | grep -F "$SCRIPT_DIR/backup.sh" >/dev/null; then
    echo "Cron entry already present."
  else
    (crontab -l 2>/dev/null || true; printf '%s\n' "$line") | crontab -
    echo "Installed nightly cron: $line"
  fi
  echo "Copy dumps off this VPS. A file that lives only here is not a backup."
  exit 0
}

notify_failure() {
  local url
  url="${ALERT_WEBHOOK_URL:-}"
  if [[ -z "$url" ]]; then
    url="$(env_value ALERT_WEBHOOK_URL)"
  fi
  [[ -n "$url" ]] || return 0
  command -v curl >/dev/null 2>&1 || return 0
  curl -fsS --max-time 10 -X POST -H 'Content-Type: application/json' \
    --data '{"text":"survey backup failed"}' "$url" || true
}

offsite_target() {
  local target="${OFFSITE_BACKUP_TARGET:-}"
  if [[ -z "$target" ]]; then
    target="$(env_value OFFSITE_BACKUP_TARGET)"
  fi
  printf '%s' "$target"
}

if [[ "${1:-}" == "--dry-run" ]]; then
  target="$(offsite_target)"
  echo "offsite=${target}"
  if [[ -n "${ALERT_WEBHOOK_URL:-}" ]] || [[ -n "$(env_value ALERT_WEBHOOK_URL)" ]]; then
    echo "webhook=set"
  else
    echo "webhook="
  fi
  echo "rsync=on-failure-exit"
  exit 0
fi

if [[ "${1:-}" == "--install-cron" ]]; then
  install_cron
fi

need_cmd docker
need_cmd gzip
[[ -f "$ENV_FILE" ]] || fail ".env not found — cannot resolve database name"

pg_user="$(env_value POSTGRES_USER)"
pg_db="$(env_value POSTGRES_DB)"
pg_user="${pg_user:-rescopesurveys}"
pg_db="${pg_db:-rescopesurveys}"

sudo_cmd mkdir -p "$BACKUP_DIR"
sudo_cmd chmod 700 "$BACKUP_DIR"

stamp="$(date +%F-%H%M)"
outfile="$BACKUP_DIR/rescopesurveys-${stamp}.sql.gz"
tmp="$(mktemp)"

echo "==> Dumping $pg_db as $pg_user -> $outfile"
if ! compose_cmd exec -T postgres pg_dump -U "$pg_user" "$pg_db" | gzip > "$tmp"; then
  rm -f "$tmp"
  notify_failure
  fail "pg_dump failed"
fi
sudo_cmd mv "$tmp" "$outfile"
sudo_cmd chmod 600 "$outfile"

target="$(offsite_target)"
if [[ -n "$target" ]]; then
  case "$target" in
    *@*:*) ;;
    *)
      notify_failure
      fail "OFFSITE_BACKUP_TARGET must look like user@host:/path"
      ;;
  esac
  dest="$target"
  [[ "$dest" == */ ]] || dest="${dest}/"
  echo "==> Copying off-host to ${dest}"
  if ! rsync -a --chmod=F600 "$outfile" "$dest"; then
    notify_failure
    fail "off-host rsync failed"
  fi
fi

echo "==> Pruning dumps older than $KEEP_DAYS days in $BACKUP_DIR"
sudo_cmd find "$BACKUP_DIR" -name 'rescopesurveys-*.sql.gz' -mtime "+$KEEP_DAYS" -delete

echo "Wrote $outfile"
echo "Restore into an empty database only, never the live ${pg_db} database:"
echo "  gunzip -c $outfile | docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres psql -U $pg_user -d rescope_restore_drill"
