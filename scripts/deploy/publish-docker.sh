#!/usr/bin/env bash
# Build and push Rescope Surveys images to Docker Hub.
# Prerequisites: docker login
#
# Usage:
#   ./scripts/deploy/publish-docker.sh          # pushes :latest
#   ./scripts/deploy/publish-docker.sh v0.1.0   # pushes :v0.1.0

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

USER="${DOCKERHUB_USER:-vitomirov}"
TAG="${1:-latest}"

API_IMAGE="${USER}/rescopesurveys-api:${TAG}"
WEB_IMAGE="${USER}/rescopesurveys-web:${TAG}"

echo "Building ${API_IMAGE}..."
docker build -t "${API_IMAGE}" -f server/Dockerfile .

echo "Building ${WEB_IMAGE}..."
docker build -t "${WEB_IMAGE}" \
  --build-arg VITE_USE_API=true \
  --build-arg VITE_PANEL_URL="${VITE_PANEL_URL:-https://panel.rescopesurveys.com}" \
  .

if [[ "${TAG}" == "latest" ]]; then
  docker tag "${API_IMAGE}" "${USER}/rescopesurveys-api:latest"
  docker tag "${WEB_IMAGE}" "${USER}/rescopesurveys-web:latest"
fi

echo "Pushing ${API_IMAGE}..."
docker push "${API_IMAGE}"

echo "Pushing ${WEB_IMAGE}..."
docker push "${WEB_IMAGE}"

echo ""
echo "Done. Images published:"
echo "  ${API_IMAGE}"
echo "  ${WEB_IMAGE}"
echo ""
echo "Partner can update with:"
echo "  docker compose pull && docker compose up -d"
