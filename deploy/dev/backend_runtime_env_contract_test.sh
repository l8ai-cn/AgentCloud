#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

grep -Fq 'load_env_file "$DEV_ENV" || true' run-backend-with-runtime-env.sh
grep -Fq 'load_env_file "$RUNTIME_ENV"' run-backend-with-runtime-env.sh
grep -Fq 'KB_GITEA_REPOSITORY_BASE_URLS=http://gitea:3000' lib/config_gen.sh
grep -Fq 'export_kb_gitea_env' lib/host_services_lite.sh
grep -Fq 'KB_GITEA_SSH_URL=' lib/host_services_lite.sh
grep -Fq 'KB_GITEA_KNOWN_HOSTS=' lib/host_services_lite.sh
grep -Fq 'ensure_known_hosts' gitea/init-gitea.sh
