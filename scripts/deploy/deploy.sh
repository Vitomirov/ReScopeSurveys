#!/usr/bin/env bash
# Redeploy Rescope Surveys on the VPS: validate secrets, pull images, restart
# the stack, wait for /health.
#
# Usage:
#   ./scripts/deploy/deploy.sh           # use IMAGE_TAG already in .env
#   ./scripts/deploy/deploy.sh v0.1.1    # write IMAGE_TAG then deploy
#
# Secrets stay in .env on the server — this script never prints them.
#
# Full guide: docs/DEPLOY.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

cd "$ROOT"

HEALTH_TIMEOUT=60
NEW_TAG="${1:-}"

validate_production_env

if [[ -n "$NEW_TAG" ]]; then
  [[ "$NEW_TAG" != -* ]] || fail "Usage: ./scripts/deploy/deploy.sh [IMAGE_TAG]"
  echo "Setting IMAGE_TAG=$NEW_TAG in .env"
  set_env_value IMAGE_TAG "$NEW_TAG"
fi

image_tag="$(env_value IMAGE_TAG)"
echo "Deploying Rescope Surveys (IMAGE_TAG=${image_tag:-latest})"

echo "==> Pulling images"
compose_cmd pull

echo "==> Starting stack"
compose_cmd up -d

health_url="$(web_health_url)"
echo "==> Waiting for ${health_url} (max ${HEALTH_TIMEOUT}s)"
deadline=$((SECONDS + HEALTH_TIMEOUT))
healthy=0
while (( SECONDS < deadline )); do
  if curl -fsS --max-time 3 "$health_url" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 2
done

echo ""
compose_cmd ps

install_panel_caddy_if_missing() {
  local src="$ROOT/docker/caddy/panel.caddy"
  local dest="/etc/caddy/panel.caddy"
  [[ -f "$src" ]] || return 0
  if [[ -f "$dest" ]]; then
    return 0
  fi
  echo "==> Installing ${dest} (left in place on later deploys)"
  sudo_cmd cp "$src" "$dest"
}

reload_caddy_if_changed() {
  local src="$ROOT/docker/caddy/Caddyfile"
  [[ -f "$src" ]] || return 0
  install_panel_caddy_if_missing
  if [[ -f /etc/caddy/Caddyfile ]] && cmp -s "$src" /etc/caddy/Caddyfile 2>/dev/null; then
    return 0
  fi
  echo "==> Updating /etc/caddy/Caddyfile"
  sudo_cmd cp "$src" /etc/caddy/Caddyfile
  sudo_cmd caddy validate --config /etc/caddy/Caddyfile
  if "$SCRIPT_DIR/check-dns.sh" >/dev/null 2>&1; then
    sudo_cmd systemctl reload caddy || sudo_cmd systemctl restart caddy
  else
    echo "Caddyfile updated but Caddy NOT reloaded — DNS is not ready for all production names."
    echo "  ./scripts/deploy/check-dns.sh"
    echo "  sudo systemctl reload caddy"
  fi
}
reload_caddy_if_changed

if (( healthy == 0 )); then
  echo ""
  echo "Recent api logs:" >&2
  compose_cmd logs --tail 40 api >&2 || true
  fail "Health check failed after ${HEALTH_TIMEOUT}s. The previous images are still on disk — roll back with: ./scripts/deploy/deploy.sh <last-good-tag>"
fi

echo ""
echo "Health check passed: ${health_url}"
echo ""
echo "Next steps:"
echo "  1. ./scripts/deploy/verify.sh"
echo "  2. Confirm Caddy:  sudo systemctl status caddy"
echo "  3. Open https://app.rescopesurveys.com and sign up (no seeded admin in production)"
echo "  4. Open a live survey on https://surveys.rescopesurveys.com/<publicPath>"
echo ""
echo "Troubleshooting: docs/DEPLOY.md"
