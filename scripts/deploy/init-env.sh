#!/usr/bin/env bash
# Create a production .env on the VPS. Generates secrets with openssl.
# Does not print secret values. Refuses to overwrite an existing .env.
#
# Usage (on the VPS, from /opt/rescopesurveys):
#   ./scripts/deploy/init-env.sh
#   IMAGE_TAG=v0.1.0 ./scripts/deploy/init-env.sh
#
# Full guide: docs/DEPLOY.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

cd "$ROOT"

FORCE=0
if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
fi

if [[ -f "$ENV_FILE" && "$FORCE" -ne 1 ]]; then
  echo ".env already exists at $ENV_FILE"
  echo "Keys present:"
  grep -E '^[A-Z_]+=' "$ENV_FILE" | cut -d= -f1 || true
  echo ""
  echo "Refusing to overwrite. To replace it, move the file aside first:"
  echo "  mv $ENV_FILE $ENV_FILE.bak.\$(date +%F-%H%M)"
  echo "  ./scripts/deploy/init-env.sh"
  echo ""
  echo "If Postgres has already been initialized, keep the original POSTGRES_PASSWORD."
  echo "Changing it in .env does not change the existing database password."
  exit 0
fi

need_cmd openssl

if [[ -f "$ENV_FILE" && "$FORCE" -eq 1 ]]; then
  echo "WARNING: --force will generate NEW secrets." >&2
  echo "If pgdata already exists, the new POSTGRES_PASSWORD will not match it." >&2
fi

postgres_password="$(openssl rand -base64 24 | tr -d '/+=')"
jwt_secret="$(openssl rand -base64 48 | tr -d '\n')"
panel_oauth_secret="$(openssl rand -base64 32 | tr -d '/+=\n')"
dockerhub_user="${DOCKERHUB_USER:-$DEFAULT_DOCKERHUB_USER}"
image_tag="${IMAGE_TAG:-latest}"
web_host_port="${WEB_HOST_PORT:-$DEFAULT_WEB_HOST_PORT}"
smtp_url="${SMTP_URL:-}"

if [[ -z "$smtp_url" ]]; then
  echo "NOTE: SMTP_URL not provided — set it in .env before deploy (SMTP_URL=smtps://user:pass@host:465)."
fi

if [[ "$image_tag" == "latest" ]]; then
  echo "WARNING: IMAGE_TAG=latest — prefer a version tag (IMAGE_TAG=v0.1.0) so rollback is possible."
fi

umask 077
cat > "$ENV_FILE" <<EOF
# Production secrets — generated $(date -u +%Y-%m-%dT%H:%M:%SZ). Do not commit.
# Recreate with: ./scripts/deploy/init-env.sh  (will not overwrite this file)

POSTGRES_USER=rescopesurveys
POSTGRES_DB=rescopesurveys
POSTGRES_PASSWORD=${postgres_password}

JWT_SECRET=${jwt_secret}

CORS_ORIGIN=https://app.rescopesurveys.com,https://rescopesurveys.com,https://www.rescopesurveys.com,https://surveys.rescopesurveys.com

# Outbound email (invites, email confirmation, password reset). Required — fill in before deploy.
SMTP_URL=${smtp_url}
EMAIL_FROM=Rescope Surveys <no-reply@rescopesurveys.com>
APP_URL=https://app.rescopesurveys.com

PANEL_OAUTH_CLIENT_ID=rescope-panel
PANEL_OAUTH_CLIENT_SECRET=${panel_oauth_secret}
PANEL_OAUTH_REDIRECT_URI=https://panel.rescopesurveys.com/api/auth/builder/callback

DOCKERHUB_USER=${dockerhub_user}
IMAGE_TAG=${image_tag}

WEB_HOST_PORT=${web_host_port}
COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml
EOF
chmod 600 "$ENV_FILE"

if [[ -n "${SUDO_USER:-}" ]]; then
  chown "$SUDO_USER:$SUDO_USER" "$ENV_FILE" 2>/dev/null || true
fi

if [[ -n "$smtp_url" ]]; then
  validate_production_env
else
  echo "Skipping full validation until SMTP_URL is set; deploy.sh will enforce it."
fi

echo "Wrote $ENV_FILE (mode 600)"
echo "Keys:"
grep -E '^[A-Z_]+=' "$ENV_FILE" | cut -d= -f1
echo ""
echo "IMAGE_TAG=$(env_value IMAGE_TAG)"
echo "DOCKERHUB_USER=$(env_value DOCKERHUB_USER)"
echo "JWT_SECRET length=${#jwt_secret}"
echo ""
echo "Store POSTGRES_PASSWORD off this server. Changing it later does not update Postgres."
echo "To change the deployed image later: ./scripts/deploy/deploy.sh v0.1.1"
