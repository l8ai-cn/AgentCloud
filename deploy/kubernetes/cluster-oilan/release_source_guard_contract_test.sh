#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT
export REAL_JQ
REAL_JQ="$(command -v jq)"

git init --bare "${TMP}/origin.git" >/dev/null
git init -b main "${TMP}/repo" >/dev/null
git -C "${TMP}/repo" config user.name "Release Contract"
git -C "${TMP}/repo" config user.email "release-contract@example.test"
git -C "${TMP}/repo" remote add origin "${TMP}/origin.git"
mkdir -p "${TMP}/bin"
export CNB_RESPONSE_FILE="${TMP}/cnb-response.json"

write_cnb_builds() {
  local status="${1:?status is required}"
  local sha
  sha="$(git -C "${TMP}/repo" rev-parse HEAD)"
  "${REAL_JQ}" -n \
    --arg status "${status}" \
    --arg sha "${sha}" \
    '{
      status: 200,
      total: 1,
      data: {
        total: "1",
        data: [{
          sha: $sha,
          status: $status,
          event: "push",
          targetRef: "main",
          pipelineFailCount: 0,
          pipelineSuccessCount: 1
        }]
      }
    }' > "${CNB_RESPONSE_FILE}"
}

cat > "${TMP}/bin/cnb" <<'EOF'
#!/usr/bin/env bash
cat "${CNB_RESPONSE_FILE:?}"
EOF
chmod +x "${TMP}/bin/cnb"
cat > "${TMP}/bin/docker" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == "pull" ]]; then
  [[ "${FAIL_PULL:-0}" != "1" ]]
  exit
fi
if [[ "${1:-} ${2:-}" == "image inspect" ]]; then
  if [[ "$*" == *"{{.Os}}/{{.Architecture}}"* ]]; then
    printf '%s\n' "${EXPECTED_PLATFORM:-linux/amd64}"
  else
    printf '%s\n' "${EXPECTED_REVISION:-${RELEASE_SOURCE_COMMIT}}"
  fi
  exit 0
fi
exit 1
EOF
chmod +x "${TMP}/bin/docker"
cat > "${TMP}/bin/jq" <<'EOF'
#!/usr/bin/env bash
if [[ "${FAIL_JQ_MODE:-}" == "aggregate" && "${1:-}" == "-c" ]]; then
  exit 1
fi
if [[ "${FAIL_JQ_MODE:-}" == "serialize" && "${1:-}" == "-n" ]]; then
  exit 1
fi
exec "${REAL_JQ}" "$@"
EOF
chmod +x "${TMP}/bin/jq"
export PATH="${TMP}/bin:${PATH}"
printf 'release\n' > "${TMP}/repo/release.txt"
git -C "${TMP}/repo" add release.txt
git -C "${TMP}/repo" commit -m "release" >/dev/null
git -C "${TMP}/repo" push -u origin main >/dev/null
write_cnb_builds success

# shellcheck source=release_source_guard.sh
source "${ROOT}/release_source_guard.sh"
release_require_pushed_clean_tree "${TMP}/repo"
[[ "${RELEASE_SOURCE_COMMIT}" == "$(git -C "${TMP}/repo" rev-parse HEAD)" ]]
mkdir -p "${TMP}/repo/deploy/kubernetes/cluster-oilan/release"
{
  printf '%s\n' 'images:'
  for image in $(release_platform_images); do
    printf '%s\n' \
      "  - name: repo.aiedulab.cn:8443/agentcloud/${image}" \
      '    digest: sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  done
} > "${TMP}/repo/deploy/kubernetes/cluster-oilan/release/kustomization.yaml"
mkdir -p \
  "${TMP}/repo/docker/agent-runtime" \
  "${TMP}/repo/backend/internal/domain/workerruntime"
cat > "${TMP}/repo/docker/agent-runtime/do-agent-release.json" <<'JSON'
{
  "image": {
    "repository": "repo.aiedulab.cn:8443/agentcloud/runner-do-agent",
    "digest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
}
JSON
cat > "${TMP}/repo/backend/internal/domain/workerruntime/runtime_catalog.lock.json" <<'JSON'
{
  "images": [
    {
      "slug": "video-studio-stable",
      "reference": "repo.aiedulab.cn:8443/agentcloud/runner-video-studio@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "digest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "enabled": true
    }
  ]
}
JSON
release_write_source_metadata "${TMP}/repo"
release_verify_source_metadata "${TMP}/repo"
source_digest="$(sha256sum "${TMP}/repo/deploy/kubernetes/cluster-oilan/release/source.json" | cut -d' ' -f1)"
export FAIL_PULL=1
if release_write_source_metadata "${TMP}/repo" 2>/dev/null; then
  echo "failed platform image pull was accepted" >&2
  exit 1
fi
unset FAIL_PULL
[[ "${source_digest}" == "$(sha256sum "${TMP}/repo/deploy/kubernetes/cluster-oilan/release/source.json" | cut -d' ' -f1)" ]]
for failure_mode in aggregate serialize; do
  if FAIL_JQ_MODE="${failure_mode}" release_write_source_metadata "${TMP}/repo" 2>/dev/null; then
    echo "failed ${failure_mode} metadata write was accepted" >&2
    exit 1
  fi
  [[ "${source_digest}" == "$(sha256sum "${TMP}/repo/deploy/kubernetes/cluster-oilan/release/source.json" | cut -d' ' -f1)" ]]
done
git -C "${TMP}/repo" add \
  deploy/kubernetes/cluster-oilan/release \
  docker/agent-runtime/do-agent-release.json \
  backend/internal/domain/workerruntime/runtime_catalog.lock.json
git -C "${TMP}/repo" commit -m "release metadata" >/dev/null
git -C "${TMP}/repo" push >/dev/null
write_cnb_builds success
release_require_pushed_clean_tree "${TMP}/repo"
release_verify_source_metadata "${TMP}/repo"

printf 'dirty\n' >> "${TMP}/repo/release.txt"
if release_require_pushed_clean_tree "${TMP}/repo" 2>/dev/null; then
  echo "dirty release tree was accepted" >&2
  exit 1
fi

git -C "${TMP}/repo" restore release.txt
printf 'unpushed\n' >> "${TMP}/repo/release.txt"
git -C "${TMP}/repo" add release.txt
git -C "${TMP}/repo" commit -m "unpushed" >/dev/null
if release_require_pushed_clean_tree "${TMP}/repo" 2>/dev/null; then
  echo "unpushed release commit was accepted" >&2
  exit 1
fi

git -C "${TMP}/repo" push >/dev/null
write_cnb_builds success
release_require_pushed_clean_tree "${TMP}/repo"

git -C "${TMP}/repo" switch -c codex/not-main >/dev/null
git -C "${TMP}/repo" push -u origin codex/not-main >/dev/null
if release_require_pushed_clean_tree "${TMP}/repo" 2>/dev/null; then
  echo "non-main release branch was accepted" >&2
  exit 1
fi

git -C "${TMP}/repo" switch main >/dev/null
write_cnb_builds pending
if release_require_pushed_clean_tree "${TMP}/repo" 2>/dev/null; then
  echo "pending CNB build was accepted" >&2
  exit 1
fi

write_cnb_builds error
if release_require_pushed_clean_tree "${TMP}/repo" 2>/dev/null; then
  echo "failed CNB build was accepted" >&2
  exit 1
fi

"${REAL_JQ}" -n '{status:200,total:0,data:{total:"0",data:[]}}' > "${CNB_RESPONSE_FILE}"
if release_require_pushed_clean_tree "${TMP}/repo" 2>/dev/null; then
  echo "missing CNB build was accepted" >&2
  exit 1
fi

git -C "${TMP}/repo" remote set-url origin "https://github.com/l8ai-cn/AgentCloud.git"
write_cnb_builds success
if release_require_pushed_clean_tree "${TMP}/repo" 2>/dev/null; then
  echo "GitHub origin was accepted" >&2
  exit 1
fi
git -C "${TMP}/repo" remote set-url origin "${TMP}/origin.git"
write_cnb_builds success
release_require_pushed_clean_tree "${TMP}/repo"

old_revision="$(git -C "${TMP}/repo" rev-parse HEAD^)"
current_revision="$(git -C "${TMP}/repo" rev-parse HEAD)"
runtime_revision="$(
  jq -r '.images["runner-do-agent"]' \
    "${TMP}/repo/deploy/kubernetes/cluster-oilan/release/source.json"
)"
jq \
  --arg commit "${current_revision}" \
  --arg backend "${old_revision}" \
  --arg web "${current_revision}" \
  '.commit = $commit | .images.backend = $backend | .images.web = $web' \
  "${TMP}/repo/deploy/kubernetes/cluster-oilan/release/source.json" \
  > "${TMP}/repo/deploy/kubernetes/cluster-oilan/release/source.json.tmp"
mv \
  "${TMP}/repo/deploy/kubernetes/cluster-oilan/release/source.json.tmp" \
  "${TMP}/repo/deploy/kubernetes/cluster-oilan/release/source.json"
EXPECTED_REVISION="${old_revision}" release_verify_image_provenance \
  "${TMP}/repo" backend
EXPECTED_REVISION="${current_revision}" release_verify_image_provenance \
  "${TMP}/repo" web
EXPECTED_REVISION="${runtime_revision}" release_verify_image_provenance \
  "${TMP}/repo" runner-do-agent runner-video-studio
if EXPECTED_PLATFORM="linux/arm64" \
  release_verify_image_provenance "${TMP}/repo" runner-do-agent 2>/dev/null; then
  echo "wrong-platform release image was accepted" >&2
  exit 1
fi
if EXPECTED_REVISION="${current_revision}" \
  release_verify_image_provenance "${TMP}/repo" backend 2>/dev/null; then
  echo "mismatched remote image provenance was accepted" >&2
  exit 1
fi
