#!/usr/bin/env bash

APP_WRITES_STOPPED=false
BACKEND_REPLICAS=""

deployment_replicas() {
  local name="${1:?deployment name is required}"
  dexec "kubectl -n ${NS} get deploy ${name} -o jsonpath='{.spec.replicas}'" |
    tail -n 1 | tr -d '\r'
}

stop_application_writes() {
  local backend
  if ! backend="$(deployment_replicas backend 2>/dev/null)"; then
    echo "==> no existing application writers"
    # Retire the former standalone marketplace Deployment if still present.
    dexec "kubectl -n ${NS} delete deploy/marketplace svc/marketplace --ignore-not-found"
    return
  fi
  [[ "${backend}" =~ ^[0-9]+$ ]]
  BACKEND_REPLICAS="${backend}"
  dexec "kubectl -n ${NS} scale deploy/backend --replicas=0"
  APP_WRITES_STOPPED=true
  dexec "set -eu; kubectl -n ${NS} wait --for=delete pod -l app=backend --timeout=180s"
  dexec "kubectl -n ${NS} delete deploy/marketplace svc/marketplace --ignore-not-found"
}

mark_application_writes_restored() {
  APP_WRITES_STOPPED=false
}
