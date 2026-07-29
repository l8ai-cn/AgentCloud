# shellcheck shell=bash
# lifecycle_frontends.sh — orchestrate web / web-admin dev servers.

# Returns 0 when something is listening and returns HTTP on the port.
_frontend_port_up() {
    local port="$1"
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://127.0.0.1:$port/" 2>/dev/null || echo "000")
    [[ "$code" =~ ^[23] ]]
}

_print_frontend_startup_summary() {
    source "$ENV_FILE"
    local web_port="${WEB_PORT:-3000}"
    local admin_port="${WEB_ADMIN_PORT:-3001}"

    echo ""
    info "前端启动状态:"
    if _frontend_port_up "$web_port"; then
        success "  web        http://localhost:$web_port"
    else
        error "  web        未就绪 (端口 $web_port) — tail -f deploy/dev/web.log"
    fi
    if _frontend_port_up "$admin_port"; then
        success "  web-admin  http://localhost:$admin_port"
    else
        error "  web-admin  未就绪 (端口 $admin_port) — tail -f deploy/dev/web-admin.log"
    fi
    echo ""
}

start_all_frontends() {
    source "$ENV_FILE"

    if [[ "${DEV_LITE:-}" == "1" ]]; then
        info "dev-lite: 仅启动 web 主前端 (跳过 web-admin)"
        start_frontend || warn "主前端未能启动"
        _print_frontend_startup_summary
        return 0
    fi

    info "启动两个前端..."
    start_frontend || warn "主前端未能启动"
    start_admin_frontend || warn "Admin Console 未能启动"

    _print_frontend_startup_summary
}
