#!/usr/bin/env bash
# Confirm production hostnames resolve to this VPS (or to EXPECTED_IP).
#
# Usage:
#   ./scripts/deploy/check-dns.sh              # expected IP = this machine's IPv4
#   ./scripts/deploy/check-dns.sh 203.0.113.10 # expected IP given explicitly
#
# Full guide: docs/DEPLOY.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

lookup_ips() {
  local name="$1"
  if command -v dig >/dev/null 2>&1; then
    dig +short A "$name" | grep -E '^[0-9.]+$' || true
  else
    getent ahostsv4 "$name" 2>/dev/null | awk '{print $1}' | sort -u || true
  fi
}

detect_local_ipv4() {
  local ip
  if command -v curl >/dev/null 2>&1; then
    ip="$(curl -4 -fsS --max-time 5 https://ifconfig.me/ip 2>/dev/null || true)"
    if [[ "$ip" =~ ^[0-9.]+$ ]]; then
      printf '%s\n' "$ip"
      return 0
    fi
  fi
  hostname -I 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i ~ /^[0-9.]+$/ && $i !~ /^127\./ && $i !~ /^10\./ && $i !~ /^172\.(1[6-9]|2[0-9]|3[0-1])\./ && $i !~ /^192\.168\./) print $i}' | head -n1
}

EXPECTED_IP="${1:-}"
if [[ -z "$EXPECTED_IP" ]]; then
  EXPECTED_IP="$(detect_local_ipv4)"
fi

[[ -n "$EXPECTED_IP" ]] || fail "Could not detect this server's public IPv4. Pass it explicitly: ./scripts/deploy/check-dns.sh YOUR_IP"

echo "Expected IPv4: $EXPECTED_IP"
echo ""

failed=0
for name in "${PRODUCTION_DOMAINS[@]}"; do
  ips="$(lookup_ips "$name" | tr '\n' ' ' | sed 's/[[:space:]]*$//')"
  if [[ -z "$ips" ]]; then
    echo "FAIL  $name  (no A record)"
    failed=1
    continue
  fi
  if lookup_ips "$name" | grep -qx "$EXPECTED_IP"; then
    echo "OK    $name  -> $ips"
  else
    echo "FAIL  $name  -> $ips  (expected $EXPECTED_IP)"
    echo "      Parking/CDN leftovers (e.g. Namecheap parking) must be deleted."
    failed=1
  fi
done

echo ""
if [[ "$failed" -ne 0 ]]; then
  fail "DNS is not ready. Point A records for app, apex, www, surveys, and panel at $EXPECTED_IP, wait for TTL, then re-run. Do not reload Caddy until this passes — Let's Encrypt will fail."
fi

echo "DNS OK — all production names resolve to $EXPECTED_IP."
