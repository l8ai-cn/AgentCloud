# shellcheck shell=bash
# lifecycle_frontends.sh — orchestrate the web dev server.

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

    echo ""
    info "前端启动状态:"
    if _frontend_port_up "$web_port"; then
        success "  web        http://localhost:$web_port"
    else
        error "  web        未就绪 (端口 $web_port) — tail -f deploy/dev/web.log"
    fi
    echo ""
}

start_all_frontends() {
    source "$ENV_FILE"
    info "启动前端..."
    start_frontend || warn "主前端未能启动"
    _print_frontend_startup_summary
}
