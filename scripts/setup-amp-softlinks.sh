#!/usr/bin/env bash
# Local companion softlinks for AMP + AgentsMesh authz SSOT.
# Softlinks under sibling checkouts are not committed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CODE_ROOT="$(cd "$ROOT/.." && pwd)"
AMP_ROOT="${AMP_ROOT:-$CODE_ROOT/amp}"

if [[ ! -d "$AMP_ROOT" ]]; then
  echo "AMP checkout not found at $AMP_ROOT (set AMP_ROOT)" >&2
  exit 1
fi

ln -sfn backend/pkg/ampauthz/authz "$ROOT/authz"
ln -sfn ../amp "$ROOT/amp"
ln -sfn amp "$CODE_ROOT/ecp"

if [[ -d "$CODE_ROOT/zhiyong" ]]; then
  ln -sfn ../amp "$CODE_ROOT/zhiyong/amp"
fi

echo "authz -> backend/pkg/ampauthz/authz"
echo "AgentsMesh/amp -> $AMP_ROOT"
echo "code/ecp -> amp"
[[ -d "$CODE_ROOT/zhiyong" ]] && echo "zhiyong/amp -> amp"
