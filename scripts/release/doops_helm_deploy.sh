#!/usr/bin/env bash
# DoOps CD for AgentsMesh oilan (AMP-aligned):
#   1) sync CNB release images → Harbor (operator host with docker)
#   2) push Helm chart + values via DoOps
#   3) helm upgrade --install on the cluster node
#
# Usage:
#   bash scripts/release/doops_helm_deploy.sh oilan
#   SKIP_IMAGE_SYNC=1 bash scripts/release/doops_helm_deploy.sh oilan
set -euo pipefail

ENVIRONMENT="${1:?usage: doops_helm_deploy.sh <environment>}"
TARGET="${DOOPS_TARGET:-gw-oilan-node}"
RELEASE_NAME="${HELM_RELEASE_NAME:-agentsmesh}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RELEASE_VERSION="$(tr -d '[:space:]' <"${REPO_ROOT}/deploy/release-version.txt")"
CHART_DIR="${REPO_ROOT}/deploy/helm/agentsmesh"
VALUES_FILE="${REPO_ROOT}/deploy/environments/${ENVIRONMENT}/values.yaml"

export PATH="/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/opt/homebrew/bin:${PATH}"

if [[ ! "${RELEASE_VERSION}" =~ ^release-[0-9]{8}$ ]]; then
  echo "invalid deploy/release-version.txt: ${RELEASE_VERSION}" >&2
  exit 64
fi
if [[ ! -f "${VALUES_FILE}" ]]; then
  echo "missing values: ${VALUES_FILE}" >&2
  exit 2
fi

NAMESPACE="$(python3 - <<PY
import yaml
print(yaml.safe_load(open("${VALUES_FILE}"))["namespace"])
PY
)"

sync_images() {
  python3 "${REPO_ROOT}/deploy/tools/render_image_sync_plan.py" "${ENVIRONMENT}" --format pairs \
    | while IFS='|' read -r source target; do
        [[ -n "${source}" && -n "${target}" ]] || continue
        echo "==> sync ${source} -> ${target}"
        if ! docker image inspect "${source}" >/dev/null 2>&1; then
          docker pull --platform linux/amd64 "${source}"
        fi
        docker tag "${source}" "${target}"
        docker push "${target}"
      done
}

if [[ "${SKIP_IMAGE_SYNC:-0}" != "1" ]]; then
  sync_images
fi

SESSION="${DOOPS_SESSION:-$(doops session | tr -d '[:space:]')}"
WS="/root/ws/${SESSION}"
echo "==> DoOps session ${SESSION} -> ${TARGET} (workspace ${WS})"

BUNDLE="$(mktemp -d)"
trap 'rm -rf "${BUNDLE}"' EXIT
mkdir -p "${BUNDLE}/chart"
cp -R "${CHART_DIR}/." "${BUNDLE}/chart/"
cp "${VALUES_FILE}" "${BUNDLE}/values.yaml"
printf '%s\n' "${RELEASE_VERSION}" >"${BUNDLE}/release-version.txt"

doops -session "${SESSION}" push --target "${TARGET}" --src "${BUNDLE}"

doops -session "${SESSION}" exec --target "${TARGET}" --cmd "
set -euo pipefail
cd ${WS}
NS='${NAMESPACE}'
RELEASE='${RELEASE_NAME}'
TAG='${RELEASE_VERSION}'

for kind_name in \
  deploy/backend deploy/web deploy/relay \
  svc/backend svc/web svc/relay \
  ingress/agentsmesh-agents ingress/agentsmesh-agents-relay \
  ingress/agentsmesh-agents-tunnel ingress/agentsmesh-login-amp-agents
do
  kind=\${kind_name%%/*}
  name=\${kind_name#*/}
  if kubectl -n \"\$NS\" get \"\$kind\" \"\$name\" >/dev/null 2>&1; then
    kubectl -n \"\$NS\" annotate \"\$kind\" \"\$name\" \
      meta.helm.sh/release-name=\$RELEASE \
      meta.helm.sh/release-namespace=\$NS --overwrite
    kubectl -n \"\$NS\" label \"\$kind\" \"\$name\" \
      app.kubernetes.io/managed-by=Helm --overwrite
  fi
done

helm upgrade --install \"\$RELEASE\" ./chart \
  --namespace \"\$NS\" \
  --create-namespace \
  -f ./values.yaml \
  --set imageTag=\"\$TAG\" \
  --history-max 3 \
  --wait --timeout 10m

kubectl -n \"\$NS\" get deploy backend web relay -o wide
kubectl -n \"\$NS\" rollout status deploy/backend --timeout=180s
kubectl -n \"\$NS\" rollout status deploy/web --timeout=180s
kubectl -n \"\$NS\" rollout status deploy/relay --timeout=180s
"

echo "deployed ${RELEASE_NAME} ${RELEASE_VERSION} via doops/${TARGET}"
