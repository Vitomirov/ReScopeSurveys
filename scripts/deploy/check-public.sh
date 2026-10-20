#!/usr/bin/env bash
# Probe the three public hosts from outside this VPS.
#   ./scripts/deploy/check-public.sh
#   ./scripts/deploy/check-public.sh --dry-run
set -euo pipefail

urls=(
  "${CHECK_APP_URL:-https://app.rescopesurveys.com}"
  "${CHECK_SURVEYS_URL:-https://surveys.rescopesurveys.com}"
  "${CHECK_PANEL_URL:-https://panel.rescopesurveys.com}"
)

if [[ "${1:-}" == "--dry-run" ]]; then
  printf '%s\n' "${urls[@]}"
  exit 0
fi

fail=0
for url in "${urls[@]}"; do
  if curl -fsS --max-time 15 -o /dev/null "$url"; then
    echo "ok ${url}"
  else
    echo "down ${url}" >&2
    fail=1
  fi
done
exit "$fail"
