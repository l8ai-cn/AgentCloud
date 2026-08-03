#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$ROOT/deploy/dev"

# Marketplace HTTP is mounted on backend; no standalone host process.
! grep -q 'start_marketplace_host' "$SCRIPT_DIR/dev.sh"
! grep -q 'start_marketplace_host_lite' "$SCRIPT_DIR/lib/host_services_lite.sh"
! test -e "$SCRIPT_DIR/air/marketplace.toml"
! test -e "$ROOT/marketplace/cmd/server/main.go"
grep -q 'marketplace/httpapi' "$ROOT/backend/internal/api/rest/marketplace_module.go"
# Dev web must proxy /api/marketplace through the same backend target.
! grep -q 'MARKETPLACE_API_PROXY_TARGET' "$ROOT/clients/web/next.config.ts"
! grep -q 'localhost:10022' "$ROOT/clients/web/next.config.ts"
grep -Fq "agent-cloud-market" "$SCRIPT_DIR/seed/seed.sql"
