#!/usr/bin/env python3
"""Build, validate, and publish a Zhiyong course package."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any
from urllib import error, parse, request


SCHEMA_VERSION = "zhiyong.course-package/v1"
PUBLICATION_STATES = {"not_requested", "pending_credentials", "published", "failed"}
ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$")
PLACEHOLDER_PATTERN = re.compile(r"\{[A-Za-z_][A-Za-z0-9_.-]*\}")
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
    lessons = course.get("lessons")
    if not isinstance(lessons, list) or not lessons:
        errors.append("course.lessons must contain at least one lesson")
        lessons = []
    seen_lessons: set[str] = set()
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
        seen_tasks: set[str] = set()
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
    if isinstance(publication, dict) and publication.get("status") == "published":
        fail("published course package cannot be marked pending credentials")
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
        try:
            with request.urlopen(req, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8", errors="replace")
        except error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            fail(f"{method} {path} -> HTTP {exc.code}: {raw}")
        except error.URLError as exc:
            fail(f"{method} {path} failed: {exc}")
        value = json.loads(raw or "{}")
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
) -> dict[str, int]:
    outline_lessons = outline.get("lessons") if isinstance(outline, dict) else None
    if not isinstance(outline_lessons, list) or len(outline_lessons) != expected["lessons"]:
        fail("course outline lesson count does not match package")
    task_count = 0
    subtask_count = 0
    for lesson_index, package_lesson in enumerate(course["lessons"]):
        outline_lesson = outline_lessons[lesson_index]
        if not isinstance(outline_lesson, dict):
            fail(f"course outline lesson {lesson_index} is invalid")
        if str(outline_lesson.get("title") or "") != str(package_lesson["title"]):
            fail(f"course outline lesson title mismatch at index {lesson_index}")
        outline_tasks = outline_lesson.get("tasks")
        if not isinstance(outline_tasks, list) or len(outline_tasks) != len(package_lesson["tasks"]):
            fail(f"course outline task count mismatch for lesson {package_lesson['id']}")
        task_count += len(outline_tasks)
        for task_index, package_task in enumerate(package_lesson["tasks"]):
            outline_task = outline_tasks[task_index]
            if not isinstance(outline_task, dict):
                fail(f"course outline task {task_index} is invalid")
            if str(outline_task.get("title") or "") != str(package_task["title"]):
                fail(f"course outline task title mismatch for {package_task['id']}")
            if str(outline_task.get("content") or "") != content_for_task(package_task, workspace_root):
                fail(f"course outline task content mismatch for {package_task['id']}")
            outline_subtasks = outline_task.get("subtasks")
            package_subtasks = package_task.get("subtasks", [])
            if not isinstance(outline_subtasks, list) or len(outline_subtasks) != len(package_subtasks):
                fail(f"course outline subtask count mismatch for {package_task['id']}")
            subtask_count += len(outline_subtasks)
            for subtask_index, package_subtask in enumerate(package_subtasks):
                outline_subtask = outline_subtasks[subtask_index]
                if not isinstance(outline_subtask, dict):
                    fail(f"course outline subtask {subtask_index} is invalid")
                if str(outline_subtask.get("title") or "") != str(package_subtask["title"]):
                    fail(f"course outline subtask title mismatch for {package_subtask['id']}")
                if str(outline_subtask.get("type") or "") != str(package_subtask["type"]):
                    fail(f"course outline subtask type mismatch for {package_subtask['id']}")
                expected_source = materialize_subtask(package_subtask, workspace_root).get("source")
                actual_source = outline_subtask.get("source")
                if isinstance(expected_source, dict):
                    if not isinstance(actual_source, dict):
                        fail(f"course outline subtask source is missing for {package_subtask['id']}")
                    for field in ("md", "url", "iframe_src", "lab_task_id", "question_json"):
                        if field not in expected_source:
                            continue
                        expected_value = expected_source[field]
                        actual_value = actual_source.get(field)
                        if actual_value != expected_value:
                            fail(f"course outline subtask source mismatch for {package_subtask['id']}: {field}")
    if task_count != expected["tasks"]:
        fail("course outline task count does not match package")
    if subtask_count != expected["subtasks"]:
        fail("course outline subtask count does not match package")
    return {"lessons": len(outline_lessons), "tasks": task_count, "subtasks": subtask_count}


def mark_publish_failed(args: argparse.Namespace, message: str) -> None:
    package_path = Path(args.file)
    try:
        package = load_package(package_path)
    except Exception:
        return
    token = str(os.environ.get("ZHIYONG_PLATFORM_API_KEY") or "").strip()
    safe_message = message.replace(token, "[REDACTED]") if token else message
    action_log = Path(args.actions_log) if args.actions_log else None
    partial_course_id = ""
    if action_log and action_log.is_file():
        for line in action_log.read_text(encoding="utf-8").splitlines():
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(row, dict) and row.get("purpose") == "create_course":
                result = row.get("result")
                if isinstance(result, dict):
                    partial_course_id = str(result.get("courseId") or "").strip()
    publication: dict[str, Any] = {
        "requested": True,
        "status": "failed",
        "error": safe_message,
        "failedAt": now_iso(),
    }
    if partial_course_id:
        publication["partialCourseId"] = partial_course_id
    package["publication"] = publication
    atomic_write_json(package_path, package)
    append_action(
        action_log,
        "ERROR",
        "/courses",
        "publish_failed",
        {
            "status": "failed",
            "error": safe_message,
            **({"partialCourseId": partial_course_id} if partial_course_id else {}),
        },
    )


def command_publish(args: argparse.Namespace) -> None:
    package_path = Path(args.file)
    workspace_root = Path(args.workspace_root)
    package = load_package(package_path)
    errors, expected = validate_package(package, workspace_root)
    if errors:
        fail("course package validation failed:\n- " + "\n- ".join(errors))
    base_url = str(args.base_url or os.environ.get("ZHIYONG_COURSE_API_BASE_URL") or "").strip()
    token = str(os.environ.get("ZHIYONG_PLATFORM_API_KEY") or "").strip()
    if not base_url:
        fail("course API base URL is required via --base-url or ZHIYONG_COURSE_API_BASE_URL")
    if not token:
        fail("teacher-scoped token is required via ZHIYONG_PLATFORM_API_KEY")
    action_log = Path(args.actions_log) if args.actions_log else None
    client = CourseApiClient(base_url, token, args.timeout)
    course = package["course"]

    columns = client.call("GET", "/columns")
    column_id = resolve_column(str(course.get("columnSelector") or ""), columns)
    append_action(action_log, "GET", "/columns", "resolve_course_column", {"columnId": column_id})

    repo_name = args.repo_name or str(package["projectId"])
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
    append_action(action_log, "POST", "/courses", "create_course", {"courseId": course_id})

    for lesson in course["lessons"]:
        created_lesson = client.call("POST", f"/courses/{parse.quote(course_id)}/lessons", {
            "title": lesson["title"],
            "description": lesson.get("description") or None,
            "status": lesson.get("status", 1),
            "sort": lesson.get("sort", 0),
        })
        if not isinstance(created_lesson, dict) or not str(created_lesson.get("id") or "").strip():
            fail(f"course API did not return lesson id for {lesson['id']}")
        lesson_id = str(created_lesson["id"])
        append_action(action_log, "POST", f"/courses/{course_id}/lessons", "create_lesson", {
            "packageLessonId": lesson["id"],
            "lessonId": lesson_id,
        })
        for task in lesson["tasks"]:
            payload = {
                "title": task["title"],
                "content": content_for_task(task, workspace_root),
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
            append_action(action_log, "POST", f"/courses/{course_id}/lessons/{lesson_id}/tasks", "create_task", {
                "packageTaskId": task["id"],
                "taskId": created_task.get("id"),
            })

    published = client.call("POST", f"/courses/{parse.quote(course_id)}/publish", {
        "message": args.message,
        "advance_published_commit": True,
    })
    published_commit = str((published or {}).get("published_commit") or "").strip() if isinstance(published, dict) else ""
    if not published_commit:
        fail("course publish response has no published_commit")
    append_action(action_log, "POST", f"/courses/{course_id}/publish", "publish_course", {
        "courseId": course_id,
        "publishedCommit": published_commit,
    })

    detail = client.call("GET", f"/courses/{parse.quote(course_id)}")
    outline = client.call("GET", f"/courses/{parse.quote(course_id)}/outline?format=json&include_content=true")
    if not isinstance(detail, dict):
        fail("course detail readback is empty")
    detail_source = detail.get("git_source")
    detail_commit = str(detail_source.get("published_commit") or "").strip() if isinstance(detail_source, dict) else ""
    if detail_commit != published_commit:
        fail(f"course detail published_commit mismatch: {detail_commit!r} != {published_commit!r}")
    outline_counts = verify_outline_matches_package(outline, course, workspace_root, expected)
    append_action(action_log, "GET", f"/courses/{course_id}", "verify_course", {
        "courseId": course_id,
        "publishedCommit": detail_commit,
    })
    append_action(action_log, "GET", f"/courses/{course_id}/outline?format=json&include_content=true", "verify_outline", {
        **outline_counts,
    })

    package["publication"] = {
        "requested": True,
        "status": "published",
        "courseId": course_id,
        "columnId": column_id,
        "publishedCommit": published_commit,
        "verifiedAt": now_iso(),
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
