#!/bin/sh
set -eu

SKILL_ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
WORKSPACE_ROOT="${AI_WORKER_WORKSPACE_ROOT:-${AI_WORKER_CWD:-$(pwd)}}"
SOCKET_PATH="${LEARNING_COMPANION_SOCKET:-${WORKSPACE_ROOT}/.agent/run/learning-companion.sock}"
PID_FILE="${WORKSPACE_ROOT}/.agent/run/learning-companion.pid"
LOG_FILE="${WORKSPACE_ROOT}/.agent/run/learning-companion.log"

mkdir -p "$(dirname "$SOCKET_PATH")"
export AI_WORKER_WORKSPACE_ROOT="$WORKSPACE_ROOT"
export AI_WORKER_CWD="$WORKSPACE_ROOT"
export LEARNING_COMPANION_STORAGE=local
export LEARNING_COMPANION_SOCKET="$SOCKET_PATH"

if [ -S "$SOCKET_PATH" ]; then
  rm -f "$SOCKET_PATH"
fi

# Replace any previous domain server for this workspace.
if [ -f "$PID_FILE" ]; then
  old_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "${old_pid:-}" ] && kill -0 "$old_pid" 2>/dev/null; then
    kill "$old_pid" 2>/dev/null || true
  fi
fi

nohup python3 "$SKILL_ROOT/program/run_domain_server.py" >>"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"

# Wait until the unix socket accepts connections.
python3 - <<PY
import os, socket, sys, time
path = os.environ["LEARNING_COMPANION_SOCKET"]
deadline = time.time() + int(os.environ.get("LEARNING_COMPANION_STARTUP_TIMEOUT_SECONDS") or "30")
while time.time() < deadline:
    if os.path.exists(path):
        try:
            with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
                sock.settimeout(1)
                sock.connect(path)
            sys.exit(0)
        except OSError:
            pass
    time.sleep(0.2)
print(f"learning-companion domain server failed to open {path}", file=sys.stderr)
sys.exit(1)
PY
