from __future__ import annotations

import os
import socket
import sys
from http.server import ThreadingHTTPServer
from pathlib import Path

# Domain server must not require do-agent acp-http inside AgentCloud pods.
os.environ.setdefault("LEARNING_COMPANION_STORAGE", "local")

PROGRAM_DIR = Path(__file__).resolve().parent
if str(PROGRAM_DIR) not in sys.path:
    sys.path.insert(0, str(PROGRAM_DIR))

import local_wiki  # noqa: E402
import server  # noqa: E402


class UnixThreadingHTTPServer(ThreadingHTTPServer):
    address_family = socket.AF_UNIX

    def server_bind(self) -> None:
        path = self.server_address
        if isinstance(path, str) and os.path.exists(path):
            os.unlink(path)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        super().server_bind()


def main() -> None:
    local_wiki.install(server)
    sock = (os.environ.get("LEARNING_COMPANION_SOCKET") or "").strip()
    if sock:
        UnixThreadingHTTPServer(sock, server.Handler).serve_forever()
        return
    port = int(os.environ.get("LEARNING_COMPANION_PORT") or "8080")
    ThreadingHTTPServer(("127.0.0.1", port), server.Handler).serve_forever()


if __name__ == "__main__":
    main()
