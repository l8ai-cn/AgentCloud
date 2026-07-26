#!/usr/bin/env bash
# Local/operator build of the daily release images (same tags CNB produces),
# then push to CNB registry and Harbor so DoOps CD can helm-upgrade.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RELEASE_VERSION="$(tr -d '[:space:]' <"${REPO_ROOT}/deploy/release-version.txt")"
CNB_REG="${CNB_REGISTRY:-docker.cnb.cool/l8ai/doworker}"
HARBOR_REG="${HARBOR_REGISTRY:-repo.aiedulab.cn:8443/agentsmesh}"
PLATFORM="${PLATFORM:-linux/amd64}"

export PATH="/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/opt/homebrew/bin:${PATH}"

if [[ ! "${RELEASE_VERSION}" =~ ^release-[0-9]{8}$ ]]; then
  echo "invalid deploy/release-version.txt: ${RELEASE_VERSION}" >&2
  exit 64
fi

services=(
  "backend:backend/Dockerfile"
  "relay:relay/Dockerfile"
  "web:clients/web/Dockerfile"
)

cd "${REPO_ROOT}"
for item in "${services[@]}"; do
  service="${item%%:*}"
  dockerfile="${item#*:}"
  cnb_image="${CNB_REG}/${service}:${RELEASE_VERSION}"
  harbor_image="${HARBOR_REG}/${service}:${RELEASE_VERSION}"
  echo "==> build ${service} (${RELEASE_VERSION})"
  docker build \
    --platform "${PLATFORM}" \
    --file "${dockerfile}" \
    --tag "${cnb_image}" \
    --tag "${harbor_image}" \
    --label "org.opencontainers.image.revision=$(git rev-parse HEAD)" \
    --label "org.opencontainers.image.version=${RELEASE_VERSION}" \
    .
  echo "==> push ${cnb_image}"
  docker push "${cnb_image}"
  echo "==> push ${harbor_image}"
  docker push "${harbor_image}"
done

echo "built and pushed ${RELEASE_VERSION}"
