#!/usr/bin/env bash
# Shared helpers for production deploy scripts. Sourced, not executed.
# shellcheck shell=bash

DEPLOY_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$DEPLOY_SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"

PRODUCTION_DOMAINS=(
  app.rescopesurveys.com
  rescopesurveys.com
  www.rescopesurveys.com
  surveys.rescopesurveys.com
  panel.rescopesurveys.com
)

DEFAULT_DOCKERHUB_USER=vitomirov
DEFAULT_WEB_HOST_PORT=8080
MIN_JWT_SECRET_LENGTH=32
MIN_COMPOSE_VERSION=2.24.0

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

is_root() {
  [[ "${EUID:-$(id -u)}" -eq 0 ]]
}

sudo_cmd() {
  if is_root; then
    "$@"
  else
    need_cmd sudo
    sudo "$@"
  fi
}

# Last assignment wins, matching how Compose reads .env. Quotes are stripped.
env_value() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 0
  sed -n "s/^[[:space:]]*${key}[[:space:]]*=//p" "$ENV_FILE" \
    | tail -n 1 \
    | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

set_env_value() {
  local key="$1"
  local value="$2"
  local tmp
  [[ -f "$ENV_FILE" ]] || fail ".env not found at $ENV_FILE"
  tmp="$(mktemp)"
  if grep -q "^[[:space:]]*${key}=" "$ENV_FILE"; then
    sed "s|^[[:space:]]*${key}=.*|${key}=${value}|" "$ENV_FILE" > "$tmp"
  else
    cat "$ENV_FILE" > "$tmp"
    printf '\n%s=%s\n' "$key" "$value" >> "$tmp"
  fi
  cat "$tmp" > "$ENV_FILE"
  rm -f "$tmp"
  chmod 600 "$ENV_FILE"
}

compose_cmd() {
  local -a docker=(docker)
  if ! docker info >/dev/null 2>&1; then
    if sudo docker info >/dev/null 2>&1; then
      docker=(sudo docker)
    else
      fail "Cannot talk to the Docker daemon. After bootstrap, run: newgrp docker   (or SSH out and back in)"
    fi
  fi
  local -a cmd=("${docker[@]}" compose -f "$ROOT/docker-compose.yml")
  if [[ -f "$ROOT/docker-compose.prod.yml" ]]; then
    cmd+=(-f "$ROOT/docker-compose.prod.yml")
  fi
  "${cmd[@]}" "$@"
}

web_health_url() {
  local port
  port="$(env_value WEB_HOST_PORT)"
  port="${port:-$DEFAULT_WEB_HOST_PORT}"
  port="${port##*:}"
  printf 'http://127.0.0.1:%s/health' "$port"
}

validate_production_env() {
  local jwt_secret postgres_password cors_origin smtp_url panel_secret panel_redirect

  [[ -f "$ENV_FILE" ]] || fail ".env not found in $ROOT — run: ./scripts/deploy/init-env.sh"

  jwt_secret="$(env_value JWT_SECRET)"
  postgres_password="$(env_value POSTGRES_PASSWORD)"

  [[ -n "$jwt_secret" ]] || fail "JWT_SECRET is missing or empty in .env — run: ./scripts/deploy/init-env.sh"
  (( ${#jwt_secret} >= MIN_JWT_SECRET_LENGTH )) || fail "JWT_SECRET is shorter than ${MIN_JWT_SECRET_LENGTH} characters — the API refuses weak secrets in production."
  case "$jwt_secret" in
    *change-me*|*dev-secret*|*load-test-secret*|*not-for-production*|*example*)
      fail "JWT_SECRET still contains a placeholder value — run: ./scripts/deploy/init-env.sh"
      ;;
  esac

  [[ -n "$postgres_password" ]] || fail "POSTGRES_PASSWORD is missing or empty in .env — run: ./scripts/deploy/init-env.sh"
  case "$postgres_password" in
    rescopesurveys|postgres|password|*change-me*|*example*)
      fail "POSTGRES_PASSWORD is a default or placeholder value — run: ./scripts/deploy/init-env.sh"
      ;;
  esac

  cors_origin="$(env_value CORS_ORIGIN)"
  if [[ -n "$cors_origin" ]]; then
    case "$cors_origin" in
      true|TRUE|'*'|reflect)
        fail "CORS_ORIGIN must be an explicit origin allowlist — not true, *, or reflect"
        ;;
    esac
  fi

  smtp_url="$(env_value SMTP_URL)"
  case "$smtp_url" in
    smtp://*|smtps://*) ;;
    *) fail "SMTP_URL is missing or not an smtp:// / smtps:// URL in .env — the API refuses to start in production without outbound email." ;;
  esac

  panel_secret="$(env_value PANEL_OAUTH_CLIENT_SECRET)"
  panel_redirect="$(env_value PANEL_OAUTH_REDIRECT_URI)"
  [[ -n "$panel_secret" ]] || fail "PANEL_OAUTH_CLIENT_SECRET is missing in .env"
  case "$panel_secret" in
    *not-for-production*|*change-me*|*example*)
      fail "PANEL_OAUTH_CLIENT_SECRET is still a local demo value"
      ;;
  esac
  [[ "$panel_redirect" == "https://panel.rescopesurveys.com/api/auth/builder/callback" ]] \
    || fail "PANEL_OAUTH_REDIRECT_URI must be https://panel.rescopesurveys.com/api/auth/builder/callback"
}

version_gte() {
  local have="$1"
  local min="$2"
  [[ "$(printf '%s\n' "$min" "$have" | sort -V | head -n1)" == "$min" ]]
}

compose_version_short() {
  docker compose version --short 2>/dev/null || docker compose version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n1
}
