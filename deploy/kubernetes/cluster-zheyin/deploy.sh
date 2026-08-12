#!/usr/bin/env bash
# Cut over / refresh Agent Cloud on doops-zheyin (gw-zy) for agents.zjcm.edu.cn.
# Reuses the existing doworker namespace + Harbor images; does not rebuild secrets/DB.
#
#   DOOPS_SESSION=$(doops session) ./deploy.sh
#   RUN_HELM=1 DOOPS_SESSION=... ./deploy.sh    # also helm-adopt backend/web/relay
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${DIR}/../../.." && pwd)"
TARGET="${DOOPS_TARGET:-gw-zy}"
SESSION="${DOOPS_SESSION:-$(doops session | tr -d '[:space:]')}"
WS="/root/ws/${SESSION}"
NS=doworker
HOST=agents.zjcm.edu.cn
TLS=zjcm-edu-cn-tls

echo "==> DoOps session ${SESSION} -> ${TARGET} (workspace ${WS})"

dexec() { doops -session "${SESSION}" exec --target "${TARGET}" --cmd "cd ${WS} && $1"; }

BUNDLE="$(mktemp -d)"
trap 'rm -rf "${BUNDLE}"' EXIT
cp "${DIR}/02-configmap.yaml" "${DIR}/40-ingress-agents.yaml" "${BUNDLE}/"
doops -session "${SESSION}" push --target "${TARGET}" --src "${BUNDLE}"

echo "==> ensure TLS covers ${HOST}"
dexec "kubectl -n ${NS} get secret ${TLS} -o jsonpath='{.data.tls\\.crt}' | base64 -d | openssl x509 -checkhost ${HOST} -noout"

echo "==> apply configmap + agents ingress"
dexec "kubectl apply -f 02-configmap.yaml -f 40-ingress-agents.yaml"
dexec "kubectl -n ${NS} delete ingress agentcloud-agents-cas-login --ignore-not-found"
dexec "kubectl -n ${NS} rollout restart deploy/backend deploy/web deploy/relay deploy/marketplace"
dexec "kubectl -n ${NS} rollout status deploy/backend --timeout=180s"
dexec "kubectl -n ${NS} rollout status deploy/web --timeout=180s"
dexec "kubectl -n ${NS} rollout status deploy/relay --timeout=180s"

echo "==> verify ${HOST}"
dexec "curl -skf --connect-timeout 10 --max-time 30 https://${HOST}/health | head -c 200; echo"
dexec "curl -skI --connect-timeout 10 --max-time 30 https://${HOST}/ | head -15"

if [[ "${RUN_HELM:-0}" == "1" ]]; then
  echo "==> helm overlay (backend/web/relay + agents ingress)"
  DOOPS_SESSION="${SESSION}" DOOPS_TARGET="${TARGET}" SKIP_IMAGE_SYNC=1 \
    bash "${REPO_ROOT}/scripts/release/doops_helm_deploy.sh" zheyin
fi

echo "zheyin ready: https://${HOST}"
