#!/usr/bin/env python3
"""Build, validate, and publish a Zhiyong course package."""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import posixpath
import re
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any
from urllib import error, parse, request
from uuid import uuid4


SCHEMA_VERSION = "zhiyong.course-package/v1"
PUBLICATION_STATES = {
    "not_requested",
    "pending_credentials",
    "prepared",
    "published",
    "published_unverified",
    "failed",
}
ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$")
PLACEHOLDER_PATTERN = re.compile(r"\{[A-Za-z_][A-Za-z0-9_.-]*\}")
MARKDOWN_LINK_PATTERN = re.compile(
    r"(?P<prefix>!?\[[^\]]*\]\()(?P<target>[^)\s]+)(?P<suffix>(?:\s+\"[^\"]*\")?\))"
)
SUBTASK_SOURCE_FIELDS = {
    "path",
    "url",
    "fileId",
    "md",
    "html",
    "iframe_src",
    "audio_url",
    "experiment_id",
    "lab_task_id",
    "project_id",
    "lab_resource_path",
    "repo_sync",
    "question_json",
}


class CoursePackageError(Exception):
    """Expected CLI contract failure."""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def fail(message: str) -> None:
    raise CoursePackageError(message)


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"file does not exist: {path}")
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        fail(f"cannot read JSON {path}: {exc}")


def load_package(path: Path) -> dict[str, Any]:
    value = read_json(path)
    if not isinstance(value, dict):
        fail("course package root must be a JSON object")
    return value


def atomic_write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
        os.replace(temporary, path)
    except BaseException:
        try:
            os.unlink(temporary)
        except OSError:
            pass
        raise


def require_id(value: str, label: str) -> str:
    normalized = str(value or "").strip()
    if not ID_PATTERN.fullmatch(normalized):
        fail(f"{label} must match {ID_PATTERN.pattern}: {value!r}")
    return normalized


def find_lesson(package: dict[str, Any], lesson_id: str) -> dict[str, Any]:
    for lesson in package.get("course", {}).get("lessons", []):
        if isinstance(lesson, dict) and lesson.get("id") == lesson_id:
            return lesson
    fail(f"lesson does not exist: {lesson_id}")


def find_task(lesson: dict[str, Any], task_id: str) -> dict[str, Any]:
    for task in lesson.get("tasks", []):
        if isinstance(task, dict) and task.get("id") == task_id:
            return task
    fail(f"task does not exist in lesson {lesson.get('id')}: {task_id}")


def parse_json_object(raw: str | None, label: str) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        fail(f"{label} must be valid JSON: {exc}")
    if not isinstance(value, dict):
        fail(f"{label} must be a JSON object")
    return value


def command_init(args: argparse.Namespace) -> None:
    path = Path(args.file)
    if path.exists() and not args.force:
        fail(f"course package already exists: {path}")
    package = {
        "schemaVersion": SCHEMA_VERSION,
        "projectId": require_id(args.project_id, "project id"),
        "course": {
            "title": args.title.strip(),
            "description": args.description.strip(),
            "type": args.type.strip(),
            "columnSelector": args.column_selector.strip(),
            "lessons": [],
        },
        "publication": {
            "requested": bool(args.publication_requested),
            "status": "pending_credentials" if args.publication_requested else "not_requested",
        },
    }
    if not package["course"]["title"]:
        fail("course title is required")
    atomic_write_json(path, package)
    print(json.dumps({"created": str(path), "schemaVersion": SCHEMA_VERSION}, ensure_ascii=False))


def command_lesson_add(args: argparse.Namespace) -> None:
    path = Path(args.file)
    package = load_package(path)
    lesson_id = require_id(args.id, "lesson id")
    lessons = package.setdefault("course", {}).setdefault("lessons", [])
    if any(isinstance(item, dict) and item.get("id") == lesson_id for item in lessons):
        fail(f"duplicate lesson id: {lesson_id}")
    lessons.append({
        "id": lesson_id,
        "title": args.title.strip(),
        "description": args.description.strip(),
        "status": args.status,
        "sort": args.sort,
        "tasks": [],
    })
    atomic_write_json(path, package)
    print(json.dumps({"lessonAdded": lesson_id}, ensure_ascii=False))


def command_task_add(args: argparse.Namespace) -> None:
    path = Path(args.file)
    package = load_package(path)
    lesson = find_lesson(package, require_id(args.lesson_id, "lesson id"))
    task_id = require_id(args.id, "task id")
    tasks = lesson.setdefault("tasks", [])
    if any(isinstance(item, dict) and item.get("id") == task_id for item in tasks):
        fail(f"duplicate task id in lesson {lesson['id']}: {task_id}")
    task: dict[str, Any] = {
        "id": task_id,
        "title": args.title.strip(),
        "type": args.type.strip() or None,
        "duration": args.duration,
        "status": args.status,
        "sort": args.sort,
        "subtasks": [],
    }
    if args.content and args.content_path:
        fail("--content and --content-path are mutually exclusive")
    if args.content_path:
        task["contentPath"] = args.content_path.strip()
    elif args.content:
        task["content"] = args.content
    tasks.append({key: value for key, value in task.items() if value is not None})
    atomic_write_json(path, package)
    print(json.dumps({"taskAdded": task_id, "lessonId": lesson["id"]}, ensure_ascii=False))


def command_subtask_add(args: argparse.Namespace) -> None:
    path = Path(args.file)
    package = load_package(path)
    lesson = find_lesson(package, require_id(args.lesson_id, "lesson id"))
    task = find_task(lesson, require_id(args.task_id, "task id"))
    subtask_id = require_id(args.id, "subtask id")
    subtasks = task.setdefault("subtasks", [])
    if any(isinstance(item, dict) and item.get("id") == subtask_id for item in subtasks):
        fail(f"duplicate subtask id in task {task['id']}: {subtask_id}")
    provided_sources = sum(bool(value) for value in (args.source_path, args.source_url, args.source_json))
    if provided_sources > 1:
        fail("--source-path, --source-url, and --source-json are mutually exclusive")
    source: dict[str, Any] | None
    if args.source_json:
        source = parse_json_object(args.source_json, "--source-json")
    elif args.source_path:
        source = {"path": args.source_path.strip()}
    elif args.source_url:
        source = {"url": args.source_url.strip()}
    else:
        source = None
    subtask: dict[str, Any] = {
        "id": subtask_id,
        "title": args.title.strip(),
        "category": args.category.strip(),
        "type": args.type.strip(),
        "source": source,
        "duration": args.duration,
        "completed": False,
        "status": args.status,
        "sort": args.sort,
        "metadata": parse_json_object(args.metadata_json, "--metadata-json") or None,
    }
    subtasks.append({key: value for key, value in subtask.items() if value is not None})
    atomic_write_json(path, package)
    print(json.dumps({"subtaskAdded": subtask_id, "taskId": task["id"]}, ensure_ascii=False))


def safe_workspace_file(raw: Any, workspace_root: Path, label: str, errors: list[str]) -> Path | None:
    if not isinstance(raw, str) or not raw.strip():
        errors.append(f"{label}: path must be a non-empty string")
        return None
    normalized = raw.strip().replace("\\", "/")
    relative = PurePosixPath(normalized)
    if relative.is_absolute() or ".." in relative.parts:
        errors.append(f"{label}: unsafe workspace path {raw!r}")
        return None
    root = workspace_root.resolve()
    target = root.joinpath(*relative.parts).resolve()
    try:
        target.relative_to(root)
    except ValueError:
        errors.append(f"{label}: path escapes workspace {raw!r}")
        return None
    if not target.is_file():
        errors.append(f"{label}: referenced file does not exist: {raw}")
    return target


def validate_package(package: dict[str, Any], workspace_root: Path) -> tuple[list[str], dict[str, int]]:
    errors: list[str] = []
    counts = {"lessons": 0, "tasks": 0, "subtasks": 0}
    if package.get("schemaVersion") != SCHEMA_VERSION:
        errors.append(f"schemaVersion must be {SCHEMA_VERSION!r}")
    try:
        require_id(str(package.get("projectId") or ""), "project id")
    except CoursePackageError as exc:
        errors.append(str(exc))
    course = package.get("course")
    if not isinstance(course, dict):
        return errors + ["course must be an object"], counts
    for field in ("title", "description", "type"):
        if not isinstance(course.get(field), str) or not course[field].strip():
            errors.append(f"course.{field} is required")
    cover_path = course.get("coverPath")
    if cover_path is not None:
        cover_file = safe_workspace_file(cover_path, workspace_root, "course.coverPath", errors)
        normalized_cover = PurePosixPath(str(cover_path or "").replace("\\", "/"))
        if not normalized_cover.parts or normalized_cover.parts[0] != "assets":
            errors.append("course.coverPath must point under assets/")
        if cover_file is not None and cover_file.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
            errors.append("course.coverPath must be a supported image file")
    lessons = course.get("lessons")
    if not isinstance(lessons, list) or not lessons:
        errors.append("course.lessons must contain at least one lesson")
        lessons = []
    seen_lessons: set[str] = set()
    seen_tasks: set[str] = set()
    for lesson_index, lesson in enumerate(lessons):
        location = f"course.lessons[{lesson_index}]"
        if not isinstance(lesson, dict):
            errors.append(f"{location} must be an object")
            continue
        lesson_id = str(lesson.get("id") or "")
        if not ID_PATTERN.fullmatch(lesson_id):
            errors.append(f"{location}.id is invalid")
        elif lesson_id in seen_lessons:
            errors.append(f"{location}.id is duplicated: {lesson_id}")
        seen_lessons.add(lesson_id)
        if not str(lesson.get("title") or "").strip():
            errors.append(f"{location}.title is required")
        tasks = lesson.get("tasks")
        if not isinstance(tasks, list) or not tasks:
            errors.append(f"{location}.tasks must contain at least one task")
            tasks = []
        counts["lessons"] += 1
        for task_index, task in enumerate(tasks):
            task_location = f"{location}.tasks[{task_index}]"
            if not isinstance(task, dict):
                errors.append(f"{task_location} must be an object")
                continue
            task_id = str(task.get("id") or "")
            if not ID_PATTERN.fullmatch(task_id):
                errors.append(f"{task_location}.id is invalid")
            elif task_id in seen_tasks:
                errors.append(f"{task_location}.id is duplicated: {task_id}")
            seen_tasks.add(task_id)
            if not str(task.get("title") or "").strip():
                errors.append(f"{task_location}.title is required")
            content = task.get("content")
            content_path = task.get("contentPath")
            if bool(content) == bool(content_path):
                errors.append(f"{task_location} must contain exactly one of content or contentPath")
            if content_path:
                safe_workspace_file(content_path, workspace_root, f"{task_location}.contentPath", errors)
            counts["tasks"] += 1
            seen_subtasks: set[str] = set()
            subtasks = task.get("subtasks", [])
            if not isinstance(subtasks, list):
                errors.append(f"{task_location}.subtasks must be an array")
                continue
            for subtask_index, subtask in enumerate(subtasks):
                subtask_location = f"{task_location}.subtasks[{subtask_index}]"
                if not isinstance(subtask, dict):
                    errors.append(f"{subtask_location} must be an object")
                    continue
                subtask_id = str(subtask.get("id") or "")
                if not ID_PATTERN.fullmatch(subtask_id):
                    errors.append(f"{subtask_location}.id is invalid")
                elif subtask_id in seen_subtasks:
                    errors.append(f"{subtask_location}.id is duplicated: {subtask_id}")
                seen_subtasks.add(subtask_id)
                for field in ("title", "category", "type"):
                    if not str(subtask.get(field) or "").strip():
                        errors.append(f"{subtask_location}.{field} is required")
                source = subtask.get("source")
                if source is not None and not isinstance(source, dict):
                    errors.append(f"{subtask_location}.source must be an object")
                elif isinstance(source, dict):
                    unknown_source_fields = sorted(set(source) - SUBTASK_SOURCE_FIELDS)
                    if unknown_source_fields:
                        errors.append(
                            f"{subtask_location}.source has unsupported fields: "
                            + ", ".join(unknown_source_fields)
                        )
                    if source.get("path"):
                        safe_workspace_file(source["path"], workspace_root, f"{subtask_location}.source.path", errors)
                        if str(subtask.get("type") or "") not in {"markdown", "html", "iframe", "quiz"}:
                            errors.append(
                                f"{subtask_location}.source.path is only supported for markdown/html/iframe/quiz"
                            )
                counts["subtasks"] += 1
    publication = package.get("publication")
    if not isinstance(publication, dict):
        errors.append("publication must be an object")
    elif publication.get("status") not in PUBLICATION_STATES:
        errors.append(f"publication.status must be one of {sorted(PUBLICATION_STATES)}")
    serialized = json.dumps(package, ensure_ascii=False)
    placeholders = sorted(set(PLACEHOLDER_PATTERN.findall(serialized)))
    if placeholders:
        errors.append("unresolved placeholders remain: " + ", ".join(placeholders))
    return errors, counts


def command_validate(args: argparse.Namespace) -> None:
    package = load_package(Path(args.file))
    errors, counts = validate_package(package, Path(args.workspace_root))
    result = {"valid": not errors, **counts, "errors": errors}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


def command_summary(args: argparse.Namespace) -> None:
    package = load_package(Path(args.file))
    errors, counts = validate_package(package, Path(args.workspace_root))
    course = package.get("course") if isinstance(package.get("course"), dict) else {}
    print(json.dumps({
        "schemaVersion": package.get("schemaVersion"),
        "projectId": package.get("projectId"),
        "title": course.get("title"),
        **counts,
        "publication": package.get("publication"),
        "valid": not errors,
        "errors": errors,
    }, ensure_ascii=False, indent=2))


def command_publication_pending(args: argparse.Namespace) -> None:
    path = Path(args.file)
    package = load_package(path)
    publication = package.get("publication")
    if isinstance(publication, dict) and publication.get("status") in {
        "published",
        "published_unverified",
    }:
        fail("platform-published course package cannot be marked pending credentials")
    package["publication"] = {
        "requested": True,
        "status": "pending_credentials",
        "reason": args.reason,
    }
    atomic_write_json(path, package)
    print(json.dumps(package["publication"], ensure_ascii=False, indent=2))


class CourseApiClient:
    def __init__(self, base_url: str, token: str, timeout: int) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout

    def call(self, method: str, path: str, body: dict[str, Any] | None = None) -> Any:
        url = f"{self.base_url}/{path.lstrip('/')}"
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
        headers = {"Accept": "application/json", "Authorization": f"Bearer {self.token}"}
        if payload is not None:
            headers["Content-Type"] = "application/json"
        req = request.Request(url, data=payload, headers=headers, method=method)
        return self._read_json_response(req, method, path)

    def upload_file(self, path: str, file_path: Path) -> Any:
        boundary = f"----zhiyong-course-{uuid4().hex}"
        content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        file_data = file_path.read_bytes()
        prefix = (
            f"--{boundary}\r\n"
            'Content-Disposition: form-data; name="file"; filename="asset"\r\n'
            f"Content-Type: {content_type}\r\n\r\n"
        ).encode("ascii")
        payload = prefix + file_data + f"\r\n--{boundary}--\r\n".encode("ascii")
        url = f"{self.base_url}/{path.lstrip('/')}"
        req = request.Request(
            url,
            data=payload,
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {self.token}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            },
            method="POST",
        )
        return self._read_json_response(req, "POST", path)

    def download_file(self, path: str) -> bytes:
        url = f"{self.base_url}/{path.lstrip('/')}"
        req = request.Request(
            url,
            headers={
                "Accept": "application/octet-stream",
                "Authorization": f"Bearer {self.token}",
            },
            method="GET",
        )
        try:
            with request.urlopen(req, timeout=self.timeout) as response:
                return response.read()
        except error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            fail(f"GET {path} -> HTTP {exc.code}: {raw}")
        except error.URLError as exc:
            fail(f"GET {path} failed: {exc}")

    def _read_json_response(self, req: request.Request, method: str, path: str) -> Any:
        try:
            with request.urlopen(req, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8", errors="replace")
        except error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            fail(f"{method} {path} -> HTTP {exc.code}: {raw}")
        except error.URLError as exc:
            fail(f"{method} {path} failed: {exc}")
        try:
            value = json.loads(raw or "{}")
        except json.JSONDecodeError as exc:
            fail(f"{method} {path} returned invalid JSON: {exc.msg}")
        if not isinstance(value, dict):
            fail(f"{method} {path} returned a non-object response")
        code = value.get("code")
        if code not in (None, 0, 200):
            fail(f"{method} {path} failed: {value.get('message') or value}")
        return value.get("data")


def response_rows(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        for key in ("data", "records", "rows", "items", "list"):
            if isinstance(value.get(key), list):
                return [item for item in value[key] if isinstance(item, dict)]
    return []


def resolve_column(selector: str, columns: Any) -> str:
    rows = response_rows(columns)
    if not rows:
        fail("course publication requires at least one enabled course column")
    requested = selector.strip()
    if not requested:
        if len(rows) == 1:
            value = str(rows[0].get("id") or rows[0].get("_id") or "").strip()
            if value:
                return value
        fail("multiple enabled course columns exist; set course.columnSelector exactly")
    requested_lower = requested.lower()
    matches = [
        row for row in rows
        if requested_lower in {
            str(row.get("id") or row.get("_id") or "").strip().lower(),
            str(row.get("code") or "").strip().lower(),
            str(row.get("name") or "").strip().lower(),
        }
    ]
    if len(matches) != 1:
        fail(f"course column selector must match exactly one enabled column: {requested}")
    value = str(matches[0].get("id") or matches[0].get("_id") or "").strip()
    if not value:
        fail(f"matched course column has no id: {requested}")
    return value


def content_for_task(task: dict[str, Any], workspace_root: Path) -> str:
    if task.get("contentPath"):
        path = safe_workspace_file(task["contentPath"], workspace_root, "task.contentPath", [])
        if path is None:
            fail(f"invalid task contentPath: {task['contentPath']}")
        return path.read_text(encoding="utf-8")
    return str(task.get("content") or "")


def rewrite_inline_asset_links(
    markdown: str,
    course_id: str,
    course_ref: str,
    label: str,
) -> str:
    normalized = str(markdown or "").replace("\r\n", "\n").replace("\r", "\n")

    def replace(match: re.Match[str]) -> str:
        target = match.group("target").strip()
        if (
            not target
            or target.startswith("#")
            or target.startswith("/")
            or "://" in target
            or target.startswith("data:")
            or target.startswith("mailto:")
        ):
            return match.group(0)
        parsed_target = parse.urlsplit(target)
        repo_path = posixpath.normpath(parse.unquote(parsed_target.path)).removeprefix("./")
        if not repo_path.startswith("assets/"):
            fail(f"{label} relative Markdown links must point under assets/: {target!r}")
        proxied = course_asset_proxy_url(course_id, course_ref, repo_path)
        if parsed_target.fragment:
            proxied = f"{proxied}#{parse.quote(parsed_target.fragment, safe='')}"
        return f"{match.group('prefix')}{proxied}{match.group('suffix')}"

    return MARKDOWN_LINK_PATTERN.sub(replace, normalized)


def course_asset_proxy_url(course_id: str, course_ref: str, repo_path: str) -> str:
    return (
        f"/api/course/courses/{parse.quote(course_id, safe='')}/git/raw"
        f"?path={parse.quote(repo_path, safe='')}&ref={parse.quote(course_ref, safe='')}"
    )


def list_course_assets(workspace_root: Path) -> list[tuple[str, Path]]:
    root = workspace_root.resolve()
    assets_root = (root / "assets").resolve()
    if not assets_root.is_dir():
        fail(f"--sync-assets requires an assets directory: {assets_root}")
    try:
        assets_root.relative_to(root)
    except ValueError:
        fail("assets directory escapes the course workspace")

    assets: list[tuple[str, Path]] = []
    for candidate in sorted(assets_root.rglob("*")):
        if not candidate.is_file():
            continue
        if candidate.is_symlink():
            fail(f"course assets cannot contain symlinks: {candidate}")
        resolved = candidate.resolve()
        try:
            relative = resolved.relative_to(root).as_posix()
            resolved.relative_to(assets_root)
        except ValueError:
            fail(f"course asset escapes the assets directory: {candidate}")
        assets.append((relative, resolved))
    if not assets:
        fail(f"--sync-assets requires at least one file under: {assets_root}")
    return assets


def sync_course_assets(
    client: CourseApiClient,
    course_id: str,
    workspace_root: Path,
) -> dict[str, int]:
    assets = list_course_assets(workspace_root)
    local_paths = {repo_path for repo_path, _ in assets}
    uploaded = 0
    skipped = 0
    deleted = 0
    total_bytes = 0
    for repo_path, file_path in assets:
        route = (
            f"/courses/{parse.quote(course_id, safe='')}/git/assets?"
            f"{parse.urlencode({'path': repo_path})}"
        )
        result = client.upload_file(route, file_path)
        if not isinstance(result, dict):
            fail(f"course asset upload returned an invalid response: {repo_path}")
        if str(result.get("path") or "") != repo_path:
            fail(f"course asset upload path mismatch: {repo_path}")
        if not str(result.get("commit") or "").strip():
            fail(f"course asset upload returned no commit: {repo_path}")
        if bool(result.get("skipped")):
            skipped += 1
        else:
            uploaded += 1
        total_bytes += file_path.stat().st_size

    list_route = f"/courses/{parse.quote(course_id, safe='')}/git/assets"
    remote_payload = client.call("GET", list_route)
    if not isinstance(remote_payload, dict) or not isinstance(remote_payload.get("assets"), list):
        fail("course asset listing returned an invalid response")
    remote_paths = {
        str(repo_path)
        for repo_path in remote_payload["assets"]
        if isinstance(repo_path, str)
    }
    for repo_path in sorted(remote_paths - local_paths):
        delete_route = f"{list_route}?{parse.urlencode({'path': repo_path})}"
        result = client.call("DELETE", delete_route)
        if not isinstance(result, dict) or str(result.get("path") or "") != repo_path:
            fail(f"course asset delete returned an invalid response: {repo_path}")
        if not str(result.get("commit") or "").strip():
            fail(f"course asset delete returned no commit: {repo_path}")
        deleted += 1

    final_payload = client.call("GET", list_route)
    if not isinstance(final_payload, dict) or not isinstance(final_payload.get("assets"), list):
        fail("course asset final listing returned an invalid response")
    final_paths = {
        str(repo_path)
        for repo_path in final_payload["assets"]
        if isinstance(repo_path, str)
    }
    if final_paths != local_paths:
        missing = sorted(local_paths - final_paths)
        extra = sorted(final_paths - local_paths)
        fail(f"course asset synchronization mismatch: missing={missing}, extra={extra}")
    return {
        "assets": len(assets),
        "uploaded": uploaded,
        "skipped": skipped,
        "deleted": deleted,
        "bytes": total_bytes,
    }


def materialize_subtask(subtask: dict[str, Any], workspace_root: Path) -> dict[str, Any]:
    result = dict(subtask)
    source = result.get("source")
    if not isinstance(source, dict):
        return result
    materialized = dict(source)
    subtask_type = str(result.get("type") or "")
    if materialized.get("path"):
        errors: list[str] = []
        path = safe_workspace_file(
            materialized["path"],
            workspace_root,
            "subtask.source.path",
            errors,
        )
        if errors or path is None:
            fail("; ".join(errors) or f"invalid subtask source path: {materialized['path']}")
        content = path.read_text(encoding="utf-8")
        materialized.pop("path", None)
        if subtask_type == "markdown":
            materialized["md"] = content
        elif subtask_type in {"html", "iframe"}:
            data_url = "data:text/html;charset=utf-8," + parse.quote(content, safe="")
            materialized["url"] = data_url
            if subtask_type == "iframe":
                materialized["iframe_src"] = data_url
        elif subtask_type == "quiz":
            try:
                materialized["question_json"] = json.loads(content)
            except json.JSONDecodeError as exc:
                fail(f"quiz source file must contain valid JSON: {exc}")
        else:
            fail(
                "subtask.source.path can only be materialized for markdown/html/iframe/quiz; "
                f"got {subtask_type!r}"
            )
    if "html" in materialized:
        if subtask_type not in {"html", "iframe"}:
            fail(f"source.html is not valid for subtask type {subtask_type!r}")
        html = str(materialized.pop("html") or "")
        data_url = "data:text/html;charset=utf-8," + parse.quote(html, safe="")
        materialized.setdefault("url", data_url)
        if subtask_type == "iframe":
            materialized.setdefault("iframe_src", data_url)
    result["source"] = materialized
    return result


def expected_outline_source(
    package_subtask: dict[str, Any],
    workspace_root: Path,
    course_id: str,
    course_ref: str,
) -> Any:
    expected_source = materialize_subtask(package_subtask, workspace_root).get("source")
    if not isinstance(expected_source, dict) or "md" not in expected_source:
        return expected_source
    normalized = dict(expected_source)
    markdown = str(normalized.get("md") or "").replace("\r\n", "\n").replace("\r", "\n")
    package_source = package_subtask.get("source")
    source_path = str(package_source.get("path") or "") if isinstance(package_source, dict) else ""
    current_dir = posixpath.dirname(source_path)

    def replace(match: re.Match[str]) -> str:
        target = match.group("target").strip()
        if (
            not target
            or target.startswith("#")
            or target.startswith("/")
            or "://" in target
            or target.startswith("data:")
            or target.startswith("mailto:")
        ):
            return match.group(0)
        resolved = posixpath.normpath(posixpath.join(current_dir, target))
        if resolved == ".." or resolved.startswith("../"):
            fail(f"markdown link escapes course workspace: {target!r}")
        proxied = (
            f"/api/course/courses/{parse.quote(course_id, safe='')}/git/raw"
            f"?path={parse.quote(resolved, safe='')}&ref={parse.quote(course_ref, safe='')}"
        )
        return f"{match.group('prefix')}{proxied}{match.group('suffix')}"

    normalized["md"] = MARKDOWN_LINK_PATTERN.sub(replace, markdown)
    return normalized


def verify_outline_task_matches_package(
    outline_task: Any,
    package_task: dict[str, Any],
    workspace_root: Path,
    course_id: str,
    course_ref: str,
) -> int:
    if not isinstance(outline_task, dict):
        fail(f"course outline task is invalid for {package_task['id']}")
    if str(outline_task.get("id") or "") != str(package_task["id"]):
        fail(f"course outline task id mismatch for {package_task['id']}")
    if str(outline_task.get("title") or "") != str(package_task["title"]):
        fail(f"course outline task title mismatch for {package_task['id']}")
    expected_content = rewrite_inline_asset_links(
        content_for_task(package_task, workspace_root),
        course_id,
        course_ref,
        f"task {package_task['id']} content",
    )
    if str(outline_task.get("content") or "") != expected_content:
        fail(f"course outline task content mismatch for {package_task['id']}")
    task_fields = {
        "type": str(package_task.get("type") or ""),
        "duration": int(package_task.get("duration") or 0),
        "status": int(package_task.get("status", 1)),
        "sort": int(package_task.get("sort", 0)),
    }
    for field, expected_value in task_fields.items():
        actual_value: Any
        if field == "type":
            actual_value = str(outline_task.get(field) or "")
        else:
            default_value = 1 if field == "status" else 0
            raw_value = outline_task.get(field)
            actual_value = int(default_value if raw_value is None else raw_value)
        if actual_value != expected_value:
            fail(f"course outline task {field} mismatch for {package_task['id']}")
    outline_subtasks = outline_task.get("subtasks")
    package_subtasks = package_task.get("subtasks", [])
    if not isinstance(outline_subtasks, list) or len(outline_subtasks) != len(package_subtasks):
        fail(f"course outline subtask count mismatch for {package_task['id']}")
    for subtask_index, package_subtask in enumerate(package_subtasks):
        outline_subtask = outline_subtasks[subtask_index]
        if not isinstance(outline_subtask, dict):
            fail(f"course outline subtask {subtask_index} is invalid")
        if str(outline_subtask.get("id") or "") != str(package_subtask["id"]):
            fail(f"course outline subtask id mismatch for {package_subtask['id']}")
        if str(outline_subtask.get("title") or "") != str(package_subtask["title"]):
            fail(f"course outline subtask title mismatch for {package_subtask['id']}")
        subtask_fields = {
            "category": str(package_subtask.get("category") or "study"),
            "type": str(package_subtask["type"]),
            "duration": int(package_subtask.get("duration") or 0),
            "completed": bool(package_subtask.get("completed", False)),
            "status": int(package_subtask.get("status", 1)),
            "sort": int(package_subtask.get("sort", 0)),
            "metadata": package_subtask.get("metadata"),
        }
        for field, expected_value in subtask_fields.items():
            actual_value = outline_subtask.get(field)
            if field in {"category", "type"}:
                actual_value = str(actual_value or ("study" if field == "category" else ""))
            elif field in {"duration", "status", "sort"}:
                default_value = 1 if field == "status" else 0
                actual_value = int(default_value if actual_value is None else actual_value)
            elif field == "completed":
                actual_value = bool(actual_value)
            if actual_value != expected_value:
                fail(f"course outline subtask {field} mismatch for {package_subtask['id']}")
        expected_source = expected_outline_source(
            package_subtask,
            workspace_root,
            course_id,
            course_ref,
        )
        actual_source = outline_subtask.get("source")
        if isinstance(expected_source, dict):
            if not isinstance(actual_source, dict):
                fail(f"course outline subtask source is missing for {package_subtask['id']}")
            normalized_actual_source = {
                field: value
                for field, value in actual_source.items()
                if value is not None and value != ""
            }
            if normalized_actual_source != expected_source:
                fail(f"course outline subtask source mismatch for {package_subtask['id']}")
        elif actual_source not in (None, {}):
            fail(f"course outline subtask source mismatch for {package_subtask['id']}")
    return len(outline_subtasks)


def verify_outline_prefix_matches_package(
    outline: Any,
    course: dict[str, Any],
    workspace_root: Path,
    course_id: str,
    course_ref: str,
) -> list[dict[str, Any]]:
    outline_lessons = outline.get("lessons") if isinstance(outline, dict) else None
    if not isinstance(outline_lessons, list):
        fail("course outline lessons are invalid")
    package_lessons = course["lessons"]
    if len(outline_lessons) > len(package_lessons):
        fail("course outline contains more lessons than the package")
    for lesson_index, outline_lesson in enumerate(outline_lessons):
        package_lesson = package_lessons[lesson_index]
        if not isinstance(outline_lesson, dict):
            fail(f"course outline lesson {lesson_index} is invalid")
        if str(outline_lesson.get("id") or "") != str(package_lesson["id"]):
            fail(f"course outline lesson id mismatch for {package_lesson['id']}")
        if str(outline_lesson.get("title") or "") != str(package_lesson["title"]):
            fail(f"course outline lesson title mismatch at index {lesson_index}")
        for field, expected_value in {
            "status": int(package_lesson.get("status", 1)),
            "sort": int(package_lesson.get("sort", 0)),
        }.items():
            default_value = 1 if field == "status" else 0
            raw_value = outline_lesson.get(field)
            if int(default_value if raw_value is None else raw_value) != expected_value:
                fail(f"course outline lesson {field} mismatch for {package_lesson['id']}")
        outline_tasks = outline_lesson.get("tasks")
        package_tasks = package_lesson["tasks"]
        if not isinstance(outline_tasks, list):
            fail(f"course outline tasks are invalid for lesson {package_lesson['id']}")
        if len(outline_tasks) > len(package_tasks):
            fail(f"course outline contains more tasks than package lesson {package_lesson['id']}")
        if lesson_index < len(outline_lessons) - 1 and len(outline_tasks) != len(package_tasks):
            fail(f"course outline is not a strict package prefix at lesson {package_lesson['id']}")
        for task_index, outline_task in enumerate(outline_tasks):
            verify_outline_task_matches_package(
                outline_task,
                package_tasks[task_index],
                workspace_root,
                course_id,
                course_ref,
            )
    return outline_lessons


def verify_lesson_summaries_match_prefix(
    summaries: Any,
    course: dict[str, Any],
    outline_lessons: list[dict[str, Any]],
    course_id: str,
    course_ref: str,
) -> None:
    rows = response_rows(summaries)
    if len(rows) != len(outline_lessons):
        fail("course lesson summary count does not match the outline prefix")
    for lesson_index, summary in enumerate(rows):
        package_lesson = course["lessons"][lesson_index]
        outline_lesson = outline_lessons[lesson_index]
        if str(summary.get("id") or "") != str(outline_lesson.get("id") or ""):
            fail(f"course lesson summary id mismatch for {package_lesson['id']}")
        expected_description = rewrite_inline_asset_links(
            str(package_lesson.get("description") or ""),
            course_id,
            course_ref,
            f"lesson {package_lesson['id']} description",
        )
        if str(summary.get("description") or "") != expected_description:
            fail(f"course lesson description mismatch for {package_lesson['id']}")
        summary_tasks = summary.get("tasks")
        outline_tasks = outline_lesson.get("tasks")
        if not isinstance(summary_tasks, list) or not isinstance(outline_tasks, list):
            fail(f"course lesson summary tasks are invalid for {package_lesson['id']}")
        if len(summary_tasks) != len(outline_tasks):
            fail(f"course lesson summary task count mismatch for {package_lesson['id']}")
        for task_index, summary_task in enumerate(summary_tasks):
            outline_task = outline_tasks[task_index]
            if str(summary_task.get("id") or "") != str(outline_task.get("id") or ""):
                fail(f"course lesson summary task id mismatch for {package_lesson['tasks'][task_index]['id']}")
            summary_subtasks = summary_task.get("subtasks")
            outline_subtasks = outline_task.get("subtasks")
            if not isinstance(summary_subtasks, list) or not isinstance(outline_subtasks, list):
                fail(f"course lesson summary subtasks are invalid for {package_lesson['tasks'][task_index]['id']}")
            if len(summary_subtasks) != len(outline_subtasks):
                fail(f"course lesson summary subtask count mismatch for {package_lesson['tasks'][task_index]['id']}")


def append_action(path: Path | None, method: str, route: str, purpose: str, result: Any) -> None:
    if path is None:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    row = {
        "at": now_iso(),
        "method": method,
        "path": route,
        "purpose": purpose,
        "result": result,
    }
    with path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(row, ensure_ascii=False) + "\n")


def verify_outline_matches_package(
    outline: Any,
    course: dict[str, Any],
    workspace_root: Path,
    expected: dict[str, int],
    course_id: str,
    course_ref: str,
) -> dict[str, int]:
    outline_lessons = verify_outline_prefix_matches_package(
        outline,
        course,
        workspace_root,
        course_id,
        course_ref,
    )
    if len(outline_lessons) != expected["lessons"]:
        fail("course outline lesson count does not match package")
    task_count = 0
    subtask_count = 0
    for lesson_index, package_lesson in enumerate(course["lessons"]):
        outline_lesson = outline_lessons[lesson_index]
        outline_tasks = outline_lesson.get("tasks")
        if not isinstance(outline_tasks, list) or len(outline_tasks) != len(package_lesson["tasks"]):
            fail(f"course outline task count mismatch for lesson {package_lesson['id']}")
        task_count += len(outline_tasks)
        for task_index, package_task in enumerate(package_lesson["tasks"]):
            subtask_count += verify_outline_task_matches_package(
                outline_tasks[task_index],
                package_task,
                workspace_root,
                course_id,
                course_ref,
            )
    if task_count != expected["tasks"]:
        fail("course outline task count does not match package")
    if subtask_count != expected["subtasks"]:
        fail("course outline subtask count does not match package")
    return {"lessons": len(outline_lessons), "tasks": task_count, "subtasks": subtask_count}


def verify_resume_course_detail(
    detail: Any,
    course_id: str,
    course: dict[str, Any],
    column_id: str,
    repo_name: str,
    course_ref: str,
    allowed_statuses: set[int] | None = None,
) -> dict[str, Any]:
    if not isinstance(detail, dict):
        fail(f"resume course does not exist: {course_id}")
    if str(detail.get("id") or "") != course_id:
        fail(f"resume course id mismatch: {detail.get('id')!r} != {course_id!r}")
    for field in ("title", "type"):
        if str(detail.get(field) or "") != str(course.get(field) or ""):
            fail(f"resume course {field} mismatch")
    expected_description = rewrite_inline_asset_links(
        str(course.get("description") or ""),
        course_id,
        course_ref,
        "course description",
    )
    if str(detail.get("description") or "") != expected_description:
        fail("resume course description mismatch")
    allowed = allowed_statuses or {0}
    status = require_course_status(detail, "resume course")
    if status not in allowed:
        if allowed == {0}:
            fail("resume course must be in draft status")
        fail(f"resume course status must be one of {sorted(allowed)}")
    if str(detail.get("column_id") or "") != column_id:
        fail("resume course column_id mismatch")
    git_source = detail.get("git_source")
    if not isinstance(git_source, dict):
        fail("resume course has no git_source")
    if str(git_source.get("repo_name") or "") != repo_name:
        fail("resume course git_source.repo_name mismatch")
    return detail


def require_course_status(detail: Any, label: str) -> int:
    if not isinstance(detail, dict) or "status" not in detail:
        fail(f"{label} status is missing")
    raw_status = detail["status"]
    if isinstance(raw_status, bool):
        fail(f"{label} status is invalid: {raw_status!r}")
    if isinstance(raw_status, int):
        status = raw_status
    elif isinstance(raw_status, str) and raw_status in {"0", "1"}:
        status = int(raw_status)
    else:
        fail(f"{label} status is invalid: {raw_status!r}")
    if status not in {0, 1}:
        fail(f"{label} status is invalid: {raw_status!r}")
    return status


def observe_course_status(
    args: argparse.Namespace,
    course_id: str,
    detail: Any,
    label: str,
) -> int:
    status = require_course_status(detail, label)
    if status == 1:
        args.partial_course_id = course_id
        args.platform_published = True
        args.confirmed_published_commit = str(
            detail.get("resolved_commit") or ""
        ).strip()
    return status


def recorded_publication_identity(package: dict[str, Any]) -> tuple[str, str, str]:
    publication = package.get("publication")
    if not isinstance(publication, dict):
        return "", "", ""
    course_id = str(
        publication.get("courseId")
        or publication.get("partialCourseId")
        or ""
    ).strip()
    published_commit = str(publication.get("publishedCommit") or "").strip()
    status = str(publication.get("status") or "").strip()
    return course_id, published_commit, status


def require_resume_publication_identity(
    package: dict[str, Any],
    resume_course_id: str,
) -> None:
    recorded_course_id, _, _ = recorded_publication_identity(package)
    if recorded_course_id and not resume_course_id:
        fail(
            "course package already records course identity "
            f"{recorded_course_id!r}; use --resume-course-id with that exact value"
        )
    if recorded_course_id and resume_course_id != recorded_course_id:
        fail(
            "resume course id does not match package publication identity: "
            f"{resume_course_id!r} != {recorded_course_id!r}"
        )


def require_resume_status_consistency(
    package: dict[str, Any],
    resume_status: int,
) -> None:
    _, _, recorded_status = recorded_publication_identity(package)
    if recorded_status in {"published", "published_unverified"} and resume_status == 0:
        fail(
            "package records a platform-published course but the platform reports draft "
            "status; refusing all course mutations"
        )


def wait_for_published_detail(
    client: CourseApiClient,
    course_id: str,
    published_commit: str,
    *,
    attempts: int = 6,
    delay_seconds: float = 0.5,
) -> dict[str, Any]:
    if attempts < 1:
        fail("published course readback attempts must be at least 1")
    last_observation = "no response"
    for attempt in range(attempts):
        try:
            detail = client.call("GET", f"/courses/{parse.quote(course_id)}")
            status = require_course_status(detail, "published course readback")
            last_commit = str(detail.get("resolved_commit") or "").strip()
            last_observation = f"status={status!r}, resolved_commit={last_commit!r}"
            if status == 1 and last_commit == published_commit:
                return detail
        except CoursePackageError as exc:
            last_observation = str(exc)
        if attempt + 1 < attempts:
            time.sleep(delay_seconds)
    fail(
        "published course readback did not converge: "
        f"{last_observation}, "
        f"expected_commit={published_commit!r}"
    )


def require_publish_action_evidence(
    action_log: Path | None,
    course_id: str,
    published_commit: str,
) -> None:
    if action_log is None or not action_log.is_file():
        fail("published course resume requires the original actions log")
    for line in action_log.read_text(encoding="utf-8").splitlines():
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(row, dict):
            continue
        result = row.get("result")
        if (
            row.get("method") == "POST"
            and row.get("purpose") == "publish_course"
            and row.get("path") == f"/courses/{course_id}/publish"
            and isinstance(result, dict)
            and str(result.get("courseId") or "") == course_id
            and str(result.get("publishedCommit") or "") == published_commit
        ):
            return
    fail("published course resume has no matching publish commit evidence")


def require_published_resume_evidence(
    package: dict[str, Any],
    action_log: Path | None,
    course_id: str,
    published_commit: str,
) -> str:
    recorded_course_id, recorded_commit, status = recorded_publication_identity(package)
    if (
        status in {"published", "published_unverified"}
        and recorded_course_id == course_id
        and recorded_commit == published_commit
    ):
        return "package"
    require_publish_action_evidence(action_log, course_id, published_commit)
    return "actions_log"


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_published_assets(
    client: CourseApiClient,
    course_id: str,
    published_commit: str,
    workspace_root: Path,
) -> dict[str, Any]:
    assets = list_course_assets(workspace_root)
    local_paths = {repo_path for repo_path, _ in assets}
    list_route = f"/courses/{parse.quote(course_id, safe='')}/git/assets"
    remote_payload = client.call("GET", list_route)
    if not isinstance(remote_payload, dict) or not isinstance(remote_payload.get("assets"), list):
        fail("published course asset listing returned an invalid response")
    remote_commit = str(remote_payload.get("commit") or "").strip()
    if remote_commit != published_commit:
        fail(
            "published course asset listing commit mismatch: "
            f"{remote_commit!r} != {published_commit!r}"
        )
    if any(not isinstance(repo_path, str) for repo_path in remote_payload["assets"]):
        fail("published course asset listing contains an invalid path")
    remote_paths = set(remote_payload["assets"])
    if remote_paths != local_paths:
        missing = sorted(local_paths - remote_paths)
        extra = sorted(remote_paths - local_paths)
        fail(f"published course asset paths mismatch: missing={missing}, extra={extra}")

    manifest = hashlib.sha256()
    total_bytes = 0
    for repo_path, file_path in assets:
        local_digest = file_sha256(file_path)
        raw_route = (
            f"/courses/{parse.quote(course_id, safe='')}/git/raw?"
            f"{parse.urlencode({'path': repo_path, 'ref': published_commit})}"
        )
        remote_data = client.download_file(raw_route)
        remote_digest = hashlib.sha256(remote_data).hexdigest()
        if remote_digest != local_digest:
            fail(f"published course asset content mismatch: {repo_path}")
        total_bytes += file_path.stat().st_size
        manifest.update(f"{repo_path}\0{local_digest}\n".encode("utf-8"))
    return {
        "assets": len(assets),
        "bytes": total_bytes,
        "assetManifestSha256": manifest.hexdigest(),
    }


def render_course_url(template: str, course_id: str) -> str:
    normalized = str(template or "").strip()
    if "{course_id}" not in normalized:
        fail("course URL template must contain {course_id}")
    course_url = normalized.replace("{course_id}", parse.quote(course_id, safe=""))
    parsed = parse.urlsplit(course_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        fail(f"course URL must be an absolute HTTP URL: {course_url!r}")
    if parsed.username or parsed.password or parsed.fragment:
        fail("course URL must not contain credentials or a fragment")
    return course_url


def mark_publish_failed(args: argparse.Namespace, message: str) -> None:
    package_path = Path(args.file)
    try:
        package = load_package(package_path)
    except Exception:
        return
    token = str(os.environ.get("ZHIYONG_PLATFORM_API_KEY") or "").strip()
    safe_message = message.replace(token, "[REDACTED]") if token else message
    action_log = Path(args.actions_log) if args.actions_log else None
    recorded_course_id, recorded_commit, recorded_status = recorded_publication_identity(
        package
    )
    if recorded_status == "published":
        return
    partial_course_id = str(
        recorded_course_id
        or getattr(args, "partial_course_id", "")
        or getattr(args, "resume_course_id", "")
        or ""
    ).strip()
    if not partial_course_id and action_log and action_log.is_file():
        for line in action_log.read_text(encoding="utf-8").splitlines():
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(row, dict) and row.get("purpose") == "create_course":
                result = row.get("result")
                if isinstance(result, dict):
                    partial_course_id = str(result.get("courseId") or "").strip()
    confirmed_published_commit = str(
        recorded_commit
        or getattr(args, "confirmed_published_commit", "")
        or ""
    ).strip()
    platform_published = bool(
        recorded_status == "published_unverified"
        or getattr(args, "platform_published", False)
        or confirmed_published_commit
    )
    if platform_published:
        publication = {
            "requested": True,
            "status": "published_unverified",
            "courseId": partial_course_id,
            "error": safe_message,
            "verificationFailedAt": now_iso(),
            **(
                {"publishedCommit": confirmed_published_commit}
                if confirmed_published_commit
                else {}
            ),
        }
        action_purpose = "publish_verification_failed"
    else:
        publication = {
            "requested": True,
            "status": "failed",
            "error": safe_message,
            "failedAt": now_iso(),
        }
        if partial_course_id:
            publication["partialCourseId"] = partial_course_id
        action_purpose = "publish_failed"
    package["publication"] = publication
    atomic_write_json(package_path, package)
    append_action(
        action_log,
        "ERROR",
        "/courses",
        action_purpose,
        {
            "status": publication["status"],
            "error": safe_message,
            **({"courseId": partial_course_id} if platform_published else {}),
            **(
                {"publishedCommit": confirmed_published_commit}
                if confirmed_published_commit
                else {}
            ),
            **(
                {"partialCourseId": partial_course_id}
                if partial_course_id and not platform_published
                else {}
            ),
        },
    )


def command_publish(args: argparse.Namespace) -> None:
    package_path = Path(args.file)
    workspace_root = Path(args.workspace_root)
    package = load_package(package_path)
    errors, expected = validate_package(package, workspace_root)
    if errors:
        fail("course package validation failed:\n- " + "\n- ".join(errors))
    course_id = str(args.resume_course_id or "").strip()
    require_resume_publication_identity(package, course_id)
    base_url = str(args.base_url or os.environ.get("ZHIYONG_COURSE_API_BASE_URL") or "").strip()
    token = str(os.environ.get("ZHIYONG_PLATFORM_API_KEY") or "").strip()
    if not base_url:
        fail("course API base URL is required via --base-url or ZHIYONG_COURSE_API_BASE_URL")
    if not token:
        fail("teacher-scoped token is required via ZHIYONG_PLATFORM_API_KEY")
    action_log = Path(args.actions_log) if args.actions_log else None
    client = CourseApiClient(base_url, token, args.timeout)
    course = package["course"]
    cover_path = str(course.get("coverPath") or "").strip()
    if cover_path and not args.sync_assets:
        fail("course.coverPath requires --sync-assets")

    columns = client.call("GET", "/columns")
    column_id = resolve_column(str(course.get("columnSelector") or ""), columns)
    append_action(action_log, "GET", "/columns", "resolve_course_column", {"columnId": column_id})

    repo_name = args.repo_name or str(package["projectId"])
    existing_lessons: list[dict[str, Any]] = []
    if course_id:
        detail = client.call("GET", f"/courses/{parse.quote(course_id)}")
        resume_status = observe_course_status(
            args,
            course_id,
            detail,
            "resume course",
        )
        require_resume_status_consistency(package, resume_status)
        detail_source = detail.get("git_source") if isinstance(detail, dict) else None
        if not isinstance(detail_source, dict):
            fail("resume course has no git_source")
        course_ref = str(detail_source.get("repo_ref") or "").strip()
        if not course_ref:
            fail("resume course git_source.repo_ref is required")
        verify_resume_course_detail(
            detail,
            course_id,
            course,
            column_id,
            repo_name,
            course_ref,
            allowed_statuses={0} if args.prepare_only else {0, 1},
        )
        outline = client.call("GET", f"/courses/{parse.quote(course_id)}/outline?format=json&include_content=true")
        existing_lessons = verify_outline_prefix_matches_package(
            outline,
            course,
            workspace_root,
            course_id,
            course_ref,
        )
        summaries = client.call("GET", f"/courses/{parse.quote(course_id)}/tasks")
        verify_lesson_summaries_match_prefix(
            summaries,
            course,
            existing_lessons,
            course_id,
            course_ref,
        )
        append_action(action_log, "GET", f"/courses/{course_id}", "resume_course", {
            "courseId": course_id,
            "existingLessons": len(existing_lessons),
            "existingTasks": sum(len(lesson.get("tasks") or []) for lesson in existing_lessons),
        })
        if resume_status == 1:
            published_commit = str(detail.get("resolved_commit") or "").strip()
            if not published_commit:
                fail("published resume course detail has no resolved_commit")
            evidence_source = require_published_resume_evidence(
                package,
                action_log,
                course_id,
                published_commit,
            )
            asset_evidence = (
                verify_published_assets(
                    client,
                    course_id,
                    published_commit,
                    workspace_root,
                )
                if args.sync_assets
                else {}
            )
            if cover_path:
                expected_cover_url = course_asset_proxy_url(course_id, course_ref, cover_path)
                if str(detail.get("cover_url") or "") != expected_cover_url:
                    fail("published resume course cover_url mismatch")
            outline_counts = verify_outline_matches_package(
                outline,
                course,
                workspace_root,
                expected,
                course_id,
                course_ref,
            )
            outline_lessons = outline.get("lessons") if isinstance(outline, dict) else None
            if not isinstance(outline_lessons, list):
                fail("published resume course outline lessons are invalid")
            verify_lesson_summaries_match_prefix(
                summaries,
                course,
                outline_lessons,
                course_id,
                course_ref,
            )
            course_url = render_course_url(args.course_url_template, course_id) if args.course_url_template else ""
            append_action(
                action_log,
                "GET",
                f"/courses/{course_id}",
                "reconcile_published_course",
                {
                    "courseId": course_id,
                    "publishedCommit": published_commit,
                    "evidenceSource": evidence_source,
                    **outline_counts,
                    **asset_evidence,
                },
            )
            package["publication"] = {
                "requested": True,
                "status": "published",
                "courseId": course_id,
                "columnId": column_id,
                "publishedCommit": published_commit,
                "verifiedAt": now_iso(),
                "reconciled": True,
                **({"courseUrl": course_url} if course_url else {}),
            }
            atomic_write_json(package_path, package)
            print(json.dumps(package["publication"], ensure_ascii=False, indent=2))
            return
    else:
        git_source_response = client.call("POST", "/courses/git-source", {
            "title": course["title"],
            "description": course["description"],
            "repo_name": repo_name,
            "type": course["type"],
            "column_id": column_id,
        })
        if not isinstance(git_source_response, dict) or not isinstance(git_source_response.get("git_source"), dict):
            fail("course API did not return git_source")
        git_source = git_source_response["git_source"]
        if not str(git_source.get("published_commit") or "").strip():
            fail("initialized Git source has no published_commit")
        append_action(action_log, "POST", "/courses/git-source", "initialize_git_course_source", {
            "repoOwner": git_source.get("repo_owner"),
            "repoName": git_source.get("repo_name"),
            "publishedCommit": git_source.get("published_commit"),
        })

        created = client.call("POST", "/courses", {
            "title": course["title"],
            "name": course["title"],
            "description": course["description"],
            "type": course["type"],
            "column_id": column_id,
            "status": 0,
            "storage_mode": "git",
            "git_source": git_source,
        })
        if not isinstance(created, dict) or not str(created.get("id") or "").strip():
            fail("course API did not return course id")
        course_id = str(created["id"])
        args.partial_course_id = course_id
        append_action(action_log, "POST", "/courses", "create_course", {"courseId": course_id})
        course_ref = str(git_source.get("repo_ref") or "").strip()
        if not course_ref:
            fail("initialized Git source has no repo_ref")
        expected_description = rewrite_inline_asset_links(
            str(course.get("description") or ""),
            course_id,
            course_ref,
            "course description",
        )
        if expected_description != str(course.get("description") or ""):
            updated_course = client.call(
                "PUT",
                f"/courses/{parse.quote(course_id)}",
                {"description": expected_description},
            )
            if not isinstance(updated_course, dict):
                fail("course API did not return the updated course")
            append_action(
                action_log,
                "PUT",
                f"/courses/{course_id}",
                "rewrite_course_asset_links",
                {"courseId": course_id},
            )

    for lesson_index, lesson in enumerate(course["lessons"]):
        if lesson_index < len(existing_lessons):
            existing_lesson = existing_lessons[lesson_index]
            lesson_id = str(existing_lesson.get("id") or "").strip()
            if not lesson_id:
                fail(f"resume course lesson has no id for {lesson['id']}")
            existing_tasks = existing_lesson.get("tasks")
            if not isinstance(existing_tasks, list):
                fail(f"resume course lesson tasks are invalid for {lesson['id']}")
        else:
            lesson_description = rewrite_inline_asset_links(
                str(lesson.get("description") or ""),
                course_id,
                course_ref,
                f"lesson {lesson['id']} description",
            )
            created_lesson = client.call("POST", f"/courses/{parse.quote(course_id)}/lessons", {
                "name": lesson["id"],
                "title": lesson["title"],
                "description": lesson_description or None,
                "status": lesson.get("status", 1),
                "sort": lesson.get("sort", 0),
            })
            if not isinstance(created_lesson, dict) or not str(created_lesson.get("id") or "").strip():
                fail(f"course API did not return lesson id for {lesson['id']}")
            lesson_id = str(created_lesson["id"])
            if lesson_id != str(lesson["id"]):
                fail(
                    f"course API lesson id mismatch: {lesson_id!r} != {lesson['id']!r}"
                )
            existing_tasks = []
            append_action(action_log, "POST", f"/courses/{course_id}/lessons", "create_lesson", {
                "packageLessonId": lesson["id"],
                "lessonId": lesson_id,
            })
        for task in lesson["tasks"][len(existing_tasks):]:
            payload = {
                "name": task["id"],
                "title": task["title"],
                "content": rewrite_inline_asset_links(
                    content_for_task(task, workspace_root),
                    course_id,
                    course_ref,
                    f"task {task['id']} content",
                ),
                "type": task.get("type"),
                "duration": task.get("duration"),
                "subtasks": [
                    materialize_subtask(subtask, workspace_root)
                    for subtask in task.get("subtasks", [])
                ],
                "status": task.get("status", 1),
                "sort": task.get("sort", 0),
            }
            created_task = client.call(
                "POST",
                f"/courses/{parse.quote(course_id)}/lessons/{parse.quote(lesson_id)}/tasks",
                {key: value for key, value in payload.items() if value is not None},
            )
            if not isinstance(created_task, dict) or not str(created_task.get("id") or "").strip():
                fail(f"course API did not return task id for {task['id']}")
            if str(created_task["id"]) != str(task["id"]):
                fail(
                    "course API task id mismatch: "
                    f"{created_task['id']!r} != {task['id']!r}"
                )
            append_action(action_log, "POST", f"/courses/{course_id}/lessons/{lesson_id}/tasks", "create_task", {
                "packageTaskId": task["id"],
                "taskId": created_task.get("id"),
            })

    if args.sync_assets:
        asset_result = sync_course_assets(client, course_id, workspace_root)
        append_action(
            action_log,
            "POST",
            f"/courses/{course_id}/git/assets",
            "sync_course_assets",
            asset_result,
        )
        if cover_path:
            updated_cover = client.call(
                "PATCH",
                f"/courses/{parse.quote(course_id)}/cover",
                {"cover_url": cover_path},
            )
            if not isinstance(updated_cover, dict):
                fail("course API did not return the updated course cover")
            append_action(
                action_log,
                "PATCH",
                f"/courses/{course_id}/cover",
                "bind_course_cover",
                {"courseId": course_id, "coverPath": cover_path},
            )

    detail = client.call("GET", f"/courses/{parse.quote(course_id)}")
    pre_publish_status = observe_course_status(
        args,
        course_id,
        detail,
        "course before publish",
    )
    if pre_publish_status != 0:
        if args.prepare_only:
            fail("prepared course must remain in draft status")
        fail("course became published before the publish request; resume it explicitly")
    outline = client.call("GET", f"/courses/{parse.quote(course_id)}/outline?format=json&include_content=true")
    summaries = client.call("GET", f"/courses/{parse.quote(course_id)}/tasks")
    if not isinstance(detail, dict):
        fail("course detail readback is empty")
    detail_source = detail.get("git_source")
    detail_ref = str(detail_source.get("repo_ref") or "").strip() if isinstance(detail_source, dict) else ""
    if not detail_ref:
        fail("course detail git_source.repo_ref is required")
    if cover_path:
        expected_cover_url = course_asset_proxy_url(course_id, detail_ref, cover_path)
        if str(detail.get("cover_url") or "") != expected_cover_url:
            fail("course detail cover_url mismatch")
    outline_counts = verify_outline_matches_package(
        outline,
        course,
        workspace_root,
        expected,
        course_id,
        detail_ref,
    )
    outline_lessons = outline.get("lessons") if isinstance(outline, dict) else None
    if not isinstance(outline_lessons, list):
        fail("course outline lessons are invalid")
    verify_lesson_summaries_match_prefix(
        summaries,
        course,
        outline_lessons,
        course_id,
        detail_ref,
    )
    course_url = render_course_url(args.course_url_template, course_id) if args.course_url_template else ""

    if args.prepare_only:
        prepared_commit = str(detail.get("resolved_commit") or "").strip()
        if not prepared_commit:
            fail("prepared course detail has no resolved_commit")
        append_action(action_log, "GET", f"/courses/{course_id}", "verify_prepared_course", {
            "courseId": course_id,
            "preparedCommit": prepared_commit,
        })
        append_action(
            action_log,
            "GET",
            f"/courses/{course_id}/outline?format=json&include_content=true",
            "verify_prepared_outline",
            outline_counts,
        )
        package["publication"] = {
            "requested": True,
            "status": "prepared",
            "courseId": course_id,
            "columnId": column_id,
            "preparedCommit": prepared_commit,
            "preparedAt": now_iso(),
            **({"courseUrl": course_url} if course_url else {}),
        }
        atomic_write_json(package_path, package)
        print(json.dumps(package["publication"], ensure_ascii=False, indent=2))
        return

    published = client.call("POST", f"/courses/{parse.quote(course_id)}/publish", {
        "message": args.message,
        "advance_published_commit": True,
    })
    published_commit = str((published or {}).get("published_commit") or "").strip() if isinstance(published, dict) else ""
    if not published_commit:
        fail("course publish response has no published_commit")
    args.partial_course_id = course_id
    args.platform_published = True
    args.confirmed_published_commit = published_commit
    append_action(action_log, "POST", f"/courses/{course_id}/publish", "publish_course", {
        "courseId": course_id,
        "publishedCommit": published_commit,
    })

    detail = wait_for_published_detail(client, course_id, published_commit)
    outline = client.call("GET", f"/courses/{parse.quote(course_id)}/outline?format=json&include_content=true")
    summaries = client.call("GET", f"/courses/{parse.quote(course_id)}/tasks")
    if not isinstance(detail, dict):
        fail("course detail readback is empty")
    detail_source = detail.get("git_source")
    detail_commit = str(detail.get("resolved_commit") or "").strip()
    detail_ref = str(detail_source.get("repo_ref") or "").strip() if isinstance(detail_source, dict) else ""
    if not detail_ref:
        fail("course detail git_source.repo_ref is required")
    if cover_path:
        expected_cover_url = course_asset_proxy_url(course_id, detail_ref, cover_path)
        if str(detail.get("cover_url") or "") != expected_cover_url:
            fail("published course detail cover_url mismatch")
    outline_counts = verify_outline_matches_package(
        outline,
        course,
        workspace_root,
        expected,
        course_id,
        detail_ref,
    )
    outline_lessons = outline.get("lessons") if isinstance(outline, dict) else None
    if not isinstance(outline_lessons, list):
        fail("course outline lessons are invalid")
    verify_lesson_summaries_match_prefix(
        summaries,
        course,
        outline_lessons,
        course_id,
        detail_ref,
    )
    append_action(action_log, "GET", f"/courses/{course_id}", "verify_course", {
        "courseId": course_id,
        "publishedCommit": detail_commit,
    })
    append_action(action_log, "GET", f"/courses/{course_id}/outline?format=json&include_content=true", "verify_outline", {
        **outline_counts,
    })
    if course_url:
        append_action(
            action_log,
            "RECORD",
            course_url,
            "record_course_url_for_browser_verification",
            {"courseUrl": course_url},
        )

    package["publication"] = {
        "requested": True,
        "status": "published",
        "courseId": course_id,
        "columnId": column_id,
        "publishedCommit": published_commit,
        "verifiedAt": now_iso(),
        **({"courseUrl": course_url} if course_url else {}),
    }
    atomic_write_json(package_path, package)
    print(json.dumps(package["publication"], ensure_ascii=False, indent=2))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Zhiyong course package CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    init = sub.add_parser("init")
    init.add_argument("--file", required=True)
    init.add_argument("--project-id", required=True)
    init.add_argument("--title", required=True)
    init.add_argument("--description", required=True)
    init.add_argument("--type", default="practice")
    init.add_argument("--column-selector", default="")
    init.add_argument("--publication-requested", action="store_true")
    init.add_argument("--force", action="store_true")
    init.set_defaults(handler=command_init)

    lesson = sub.add_parser("lesson-add")
    lesson.add_argument("--file", required=True)
    lesson.add_argument("--id", required=True)
    lesson.add_argument("--title", required=True)
    lesson.add_argument("--description", default="")
    lesson.add_argument("--status", type=int, default=1)
    lesson.add_argument("--sort", type=int, required=True)
    lesson.set_defaults(handler=command_lesson_add)

    task = sub.add_parser("task-add")
    task.add_argument("--file", required=True)
    task.add_argument("--lesson-id", required=True)
    task.add_argument("--id", required=True)
    task.add_argument("--title", required=True)
    task.add_argument("--content")
    task.add_argument("--content-path")
    task.add_argument("--type", default="learning")
    task.add_argument("--duration", type=int, default=0)
    task.add_argument("--status", type=int, default=1)
    task.add_argument("--sort", type=int, required=True)
    task.set_defaults(handler=command_task_add)

    subtask = sub.add_parser("subtask-add")
    subtask.add_argument("--file", required=True)
    subtask.add_argument("--lesson-id", required=True)
    subtask.add_argument("--task-id", required=True)
    subtask.add_argument("--id", required=True)
    subtask.add_argument("--title", required=True)
    subtask.add_argument("--category", default="study")
    subtask.add_argument("--type", required=True)
    subtask.add_argument("--source-path")
    subtask.add_argument("--source-url")
    subtask.add_argument("--source-json")
    subtask.add_argument("--metadata-json")
    subtask.add_argument("--duration", type=int, default=0)
    subtask.add_argument("--status", type=int, default=1)
    subtask.add_argument("--sort", type=int, required=True)
    subtask.set_defaults(handler=command_subtask_add)

    validate = sub.add_parser("validate")
    validate.add_argument("--file", required=True)
    validate.add_argument("--workspace-root", required=True)
    validate.set_defaults(handler=command_validate)

    summary = sub.add_parser("summary")
    summary.add_argument("--file", required=True)
    summary.add_argument("--workspace-root", required=True)
    summary.set_defaults(handler=command_summary)

    pending = sub.add_parser("publication-pending")
    pending.add_argument("--file", required=True)
    pending.add_argument("--reason", default="teacher_credentials_missing")
    pending.set_defaults(handler=command_publication_pending)

    publish = sub.add_parser("publish")
    publish.add_argument("--file", required=True)
    publish.add_argument("--workspace-root", required=True)
    publish.add_argument("--base-url")
    publish.add_argument("--repo-name")
    publish.add_argument("--resume-course-id")
    publish.add_argument("--prepare-only", action="store_true")
    publish.add_argument("--sync-assets", action="store_true")
    publish.add_argument("--course-url-template")
    publish.add_argument("--actions-log")
    publish.add_argument("--message", default="AI 教师助理完成课程构建并发布")
    publish.add_argument("--timeout", type=int, default=60)
    publish.set_defaults(handler=command_publish)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    try:
        args.handler(args)
    except SystemExit:
        raise
    except Exception as exc:
        if args.command == "publish":
            mark_publish_failed(args, str(exc))
        raise SystemExit(str(exc)) from exc


if __name__ == "__main__":
    main()
