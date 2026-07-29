# shellcheck shell=bash
# bootstrap.sh — once-per-environment data setup.
#
# After docker compose up, this module:
#   - waits for postgres + gitea readiness
#   - provisions the schema on an empty database
#   - seeds users + LemonSqueezy variant ids
#   - registers the runner SSH key with Gitea
#   - writes ~/.ssh/config so host-side `git@gitea:...` resolves
# Re-runs are idempotent (existing data → skip).

# Generic docker-exec health probe. Polls `docker exec $container $check_cmd`
# at 2s intervals up to 240 attempts (8min) — cold CI pulls + first-start
# init can run well past 60s.
wait_for_service() {
    local container="$1"
    local check_cmd="$2"
    local max_retries=240

    for ((i=1; i<=max_retries; i++)); do
        if docker exec "$container" $check_cmd &>/dev/null; then
            return 0
        fi
        sleep 2
    done
    return 1
}

# 全新空库用 backend/schema/schema.sql 建 schema——那是权威库的整体快照。
# 已有表的库一律不碰：结构变更只通过 DoSql 直连目标库，本地不做增量对齐，
# 免得开发库和权威库之间出现第二条演进路径。
provision_schema() {
    local pg_container="$1"

    local table_count
    table_count=$(docker exec "$pg_container" psql -U agentcloud -d agentcloud -t -A -c \
        "SELECT count(*) FROM information_schema.tables
         WHERE table_schema IN ('public','marketplace') AND table_type='BASE TABLE'" \
        2>/dev/null | tr -d ' ')

    if [[ "${table_count:-0}" -gt 0 ]]; then
        info "数据库已有 ${table_count} 张表，跳过 schema provisioning"
        return 0
    fi

    info "空库：应用 backend/schema/schema.sql..."
    if ! docker exec -i "$pg_container" psql -q -v ON_ERROR_STOP=1 \
        -U agentcloud -d agentcloud < "$SCHEMA_FILE"; then
        error "schema provisioning 失败 — 数据库处于半建状态，请清空后重试"
        return 1
    fi
    success "schema provisioning 完成"
}

init_seed() {
    local pg_container="$1"

    local user_exists
    user_exists=$(docker exec "$pg_container" psql -U agentcloud -d agentcloud -t -c \
        "SELECT COUNT(*) FROM users WHERE email = 'dev@agentcloud.local'" 2>/dev/null | tr -d ' ')

    if [[ "$user_exists" -gt 0 ]]; then
        info "重放幂等基础 seed，修复开发运行时配置..."
    else
        info "初始化基础 seed..."
    fi
    if ! docker exec -i "$pg_container" psql -v ON_ERROR_STOP=1 -U agentcloud -d agentcloud < "$SEED_FILE"; then
        error "基础 seed 失败（常见原因：seed.sql 引用了已删除的表）"
        return 1
    fi

    if [[ -f "$LEMONSQUEEZY_SEED_FILE" ]]; then
        info "配置 LemonSqueezy Variant IDs..."
        if ! docker exec -i "$pg_container" psql -v ON_ERROR_STOP=1 -U agentcloud -d agentcloud < "$LEMONSQUEEZY_SEED_FILE"; then
            error "LemonSqueezy seed 失败"
            return 1
        fi
    fi
    success "基础 seed 数据初始化完成"

    # e2e-echo mock agent — always apply (idempotent via ON CONFLICT DO
    # UPDATE) so that test agentfile / scenario tweaks land on existing
    # dev DBs without forcing a full reset. Production migrations never
    # touch this row (see ADR 2026-05-26-test-fixture-isolation).
    if [[ -f "$E2E_ECHO_SEED_FILE" ]]; then
        info "初始化 e2e-echo 测试 agent seed..."
        docker exec -i "$pg_container" psql -U agentcloud -d agentcloud < "$E2E_ECHO_SEED_FILE" &>/dev/null
        success "e2e-echo seed 应用完成"
    fi
}

sync_worker_definition_projections() {
    local repo_root="$SCRIPT_DIR/../.."

    info "同步 Worker Definition 数据库投影..."
    (
        cd "$repo_root"
        DB_HOST=localhost \
        DB_PORT="$POSTGRES_PORT" \
        DB_USER=agentcloud \
        DB_PASSWORD="${POSTGRES_PASSWORD:-agentcloud_dev}" \
        DB_NAME=agentcloud \
        DB_SSLMODE=disable \
        PREVIEW_PUBLIC_ORIGIN="$PREVIEW_PUBLIC_ORIGIN" \
        WORKER_DEFINITIONS_DIR=config/worker-types \
        go run ./backend/cmd/worker-definition-sync
    ) || {
        error "Worker Definition 数据库投影同步失败"
        return 1
    }
    success "Worker Definition 数据库投影同步完成"
}

# Gitea-side bootstrap: admin user + dev-org + 2 demo repos + register the
# runner SSH public key as a deploy key. Delegated to gitea/init-gitea.sh
# so the dev.sh main flow stays declarative.
init_gitea() {
    local gitea_container="${COMPOSE_PROJECT_NAME}-gitea-1"
    source "$ENV_FILE"
    local gitea_port="${GITEA_HTTP_PORT:-3001}"

    info "等待 Gitea 就绪..."
    local max_retries=30
    for ((i=1; i<=max_retries; i++)); do
        if curl -s "http://localhost:${gitea_port}/api/v1/version" &>/dev/null; then
            break
        fi
        if [[ $i -eq $max_retries ]]; then
            warn "Gitea 启动超时，跳过初始化"
            return 0
        fi
        sleep 2
    done
    success "Gitea 已就绪"

    "$SCRIPT_DIR/gitea/init-gitea.sh" "$gitea_container" "$gitea_port"
}

# Configure ~/.ssh/config so host-side `git@gitea:org/repo.git` resolves.
# Inside docker, `gitea` is a service-DNS hostname; on the host it would
# fail with "nodename not known". We add a managed Host block that maps
# gitea → 127.0.0.1:GITEA_SSH_PORT. Idempotent — old block is stripped
# before the new one is written, so the port is always current.
setup_gitea_ssh_config() {
    source "$ENV_FILE"
    local ssh_dir="$HOME/.ssh"
    local ssh_config="$ssh_dir/config"
    local gitea_ssh_port="${GITEA_SSH_PORT:-2222}"
    local identity_file="$SCRIPT_DIR/runner-ssh/id_ed25519"
    local marker_start="# BEGIN Agent Cloud dev gitea"
    local marker_end="# END Agent Cloud dev gitea"

    mkdir -p "$ssh_dir"
    chmod 700 "$ssh_dir"
    [[ -f "$ssh_config" ]] || touch "$ssh_config"
    chmod 600 "$ssh_config"

    local tmp
    tmp=$(mktemp)
    awk "/^${marker_start}$/,/^${marker_end}$/{next} {print}" "$ssh_config" > "$tmp"
    cat "$tmp" > "$ssh_config"
    rm -f "$tmp"

    cat >> "$ssh_config" << EOF

${marker_start}
Host gitea
    HostName 127.0.0.1
    Port ${gitea_ssh_port}
    IdentityFile ${identity_file}
    IdentitiesOnly yes
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
${marker_end}
EOF

    success "SSH config: git@gitea:... → 127.0.0.1:${gitea_ssh_port} (key: runner-ssh/id_ed25519)"
}
