"""Local filesystem wiki backend for AgentCloud sandboxes.

AgentCloud runs do-agent over ACP stdio, not acp-http. The domain server
therefore reads and writes wiki pages directly under the workspace root.
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def install(server: Any) -> None:
    root = Path(
        os.environ.get("AI_WORKER_WORKSPACE_ROOT")
        or os.environ.get("AI_WORKER_CWD")
        or server.DEFAULT_WORKSPACE_ROOT
        or "/workspace"
    ).resolve()
    original_rpc = server.rpc

    def rpc(method: str, params: dict[str, Any] | None = None, timeout: float = 180.0) -> dict[str, Any]:
        params = params or {}
        if method == "fs/mkdir":
            path = Path(str(params.get("path") or root))
            path.mkdir(parents=True, exist_ok=True)
            return {"ok": True, "path": str(path)}
        if method == "wiki/init":
            (root / "wiki" / "pages").mkdir(parents=True, exist_ok=True)
            return {"ok": True, "root": str(root)}
        if method == "wiki/status":
            return {"root": str(root), "ready": True}
        if method == "wiki/listPages":
            return {"pages": _list_pages(root, limit=int(params.get("limit") or 500))}
        if method == "wiki/getTree":
            return {"tree": {"nodes": _tree_nodes(root)}}
        if method == "wiki/listAssets":
            return {"assets": []}
        if method == "wiki/getPage":
            page = _read_page(root, str(params.get("path") or ""))
            if page is None:
                raise RuntimeError(f"wiki page not found: {params.get('path')}")
            return {"page": page}
        if method == "wiki/savePage":
            return _save_page(root, params)
        return original_rpc(method, params, timeout)

    server.rpc = rpc
    server.DEFAULT_WORKSPACE_ROOT = str(root)


def _list_pages(root: Path, *, limit: int) -> list[dict[str, Any]]:
    pages_dir = root / "wiki" / "pages"
    if not pages_dir.is_dir():
        return []
    pages: list[dict[str, Any]] = []
    for path in sorted(pages_dir.rglob("*.md")):
        rel = path.relative_to(root).as_posix()
        pages.append(
            {
                "path": rel,
                "title": _title_from_file(path) or path.stem,
                "updatedAt": datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(),
            }
        )
        if len(pages) >= limit:
            break
    return pages


def _tree_nodes(root: Path) -> list[dict[str, Any]]:
    pages_dir = root / "wiki" / "pages"
    if not pages_dir.is_dir():
        return []
    return [{"path": path.relative_to(root).as_posix(), "type": "file"} for path in sorted(pages_dir.rglob("*.md"))]


def _read_page(root: Path, path: str) -> dict[str, Any] | None:
    for candidate in _candidates(path):
        file_path = root / candidate
        if not file_path.is_file():
            continue
        content = file_path.read_text(encoding="utf-8", errors="replace")
        return {
            "path": candidate if candidate.startswith("wiki/") else f"wiki/{candidate}",
            "title": _title_from_content(content) or file_path.stem,
            "content": content,
            "updatedAt": datetime.fromtimestamp(file_path.stat().st_mtime, tz=timezone.utc).isoformat(),
        }
    return None


def _save_page(root: Path, params: dict[str, Any]) -> dict[str, Any]:
    raw_path = str(params.get("path") or "").strip().lstrip("/")
    if isinstance(params.get("page"), dict):
        page = params["page"]
        raw_path = str(page.get("path") or raw_path).strip().lstrip("/")
        content = str(page.get("content") or "")
        title = str(page.get("title") or "")
    else:
        content = str(params.get("content") or "")
        title = str(params.get("title") or "")
    if not raw_path:
        raise RuntimeError("wiki/savePage requires path")
    if not raw_path.startswith("wiki/"):
        if raw_path.startswith("pages/"):
            raw_path = f"wiki/{raw_path}"
        else:
            raw_path = f"wiki/pages/{raw_path}"
    file_path = root / raw_path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    if title and not content.lstrip().startswith("#"):
        content = f"# {title}\n\n{content}"
    file_path.write_text(content, encoding="utf-8")
    return {"page": {"path": raw_path, "title": title or file_path.stem, "content": content}}


def _candidates(path: str) -> list[str]:
    normalized = str(path or "").strip().lstrip("/")
    if not normalized:
        return []
    out = [normalized]
    if normalized.startswith("wiki/"):
        out.append(normalized.removeprefix("wiki/"))
    else:
        out.append(f"wiki/{normalized}")
    return list(dict.fromkeys(out))


def _title_from_file(path: Path) -> str:
    try:
        return _title_from_content(path.read_text(encoding="utf-8", errors="replace"))
    except OSError:
        return ""


def _title_from_content(content: str) -> str:
    match = re.search(r"^#\s+(.+)$", content or "", flags=re.M)
    return match.group(1).strip() if match else ""
