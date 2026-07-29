#!/usr/bin/env python3
"""Validate the canonical Git-backed course schema."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any

import yaml


COURSE_REQUIRED = ("title", "type", "column_id", "status", "sort")
LESSON_REQUIRED = ("id", "title", "status", "sort", "path", "tasks")
TASK_INDEX_REQUIRED = ("id", "title", "status", "sort", "path", "subtasks")
TASK_REQUIRED = ("id", "title", "status", "sort", "subtasks")
SUBTASK_REQUIRED = ("id", "title", "type", "status", "sort")
INDEX_SUBTASK_FIELDS = (
    "id",
    "title",
    "category",
    "type",
    "duration",
    "completed",
    "status",
    "sort",
    "metadata",
)


@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    counts: dict[str, int] = field(
        default_factory=lambda: {"lessons": 0, "tasks": 0, "subtasks": 0}
    )

    def error(self, location: str, message: str) -> None:
        self.errors.append(f"{location}: {message}")

    def warning(self, location: str, message: str) -> None:
        self.warnings.append(f"{location}: {message}")


def load_yaml(path: Path, report: Report) -> dict[str, Any] | None:
    try:
        value = yaml.safe_load(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        report.error(str(path), "file does not exist")
        return None
    except (OSError, UnicodeError, yaml.YAMLError) as exc:
        report.error(str(path), f"cannot read YAML: {exc}")
        return None
    if not isinstance(value, dict):
        report.error(str(path), "root value must be a mapping")
        return None
    return value


def load_json(path: Path, report: Report) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        report.error(str(path), f"cannot read JSON: {exc}")
        return None


def derive_quiz_metadata(question_json: Any) -> dict[str, Any] | None:
    if isinstance(question_json, list):
        values = [str(item) for item in question_json]
        return {"questionIds": values} if values else None
    if not isinstance(question_json, dict):
        return None
    for key in ("questionIds", "question_ids"):
        if isinstance(question_json.get(key), list):
            return {"questionIds": [str(item) for item in question_json[key]]}
    raw_groups = question_json.get("questionGroups") or question_json.get("question_groups")
    if isinstance(raw_groups, dict):
        return {
            "questionGroups": {
                key: [str(item) for item in (raw_groups.get(key) or [])]
                for key in ("judge", "single", "multiple")
            }
        }
    if any(isinstance(question_json.get(key), list) for key in ("judge", "single", "multiple")):
        return {
            "questionGroups": {
                key: [str(item) for item in (question_json.get(key) or [])]
                for key in ("judge", "single", "multiple")
            }
        }
    return None


def explicit_quiz_metadata(metadata: dict[str, Any]) -> dict[str, Any] | None:
    if isinstance(metadata.get("questionIds"), list):
        return {"questionIds": [str(item) for item in metadata["questionIds"]]}
    if isinstance(metadata.get("questionGroups"), dict):
        groups = metadata["questionGroups"]
        return {
            "questionGroups": {
                key: [str(item) for item in (groups.get(key) or [])]
                for key in ("judge", "single", "multiple")
            }
        }
    return None


def require_fields(
    value: dict[str, Any], required: tuple[str, ...], location: str, report: Report
) -> None:
    for key in required:
        if key not in value or value[key] is None or value[key] == "":
            report.error(location, f"missing required field {key!r}")


def require_int(value: dict[str, Any], key: str, location: str, report: Report) -> None:
    if key in value and (isinstance(value[key], bool) or not isinstance(value[key], int)):
        report.error(location, f"{key!r} must be an integer")


def safe_repo_path(raw: Any, location: str, report: Report) -> PurePosixPath | None:
    if not isinstance(raw, str) or not raw.strip():
        report.error(location, "path must be a non-empty repository-relative string")
        return None
    normalized = raw.strip().replace("\\", "/")
    path = PurePosixPath(normalized)
    if path.is_absolute() or ".." in path.parts:
        report.error(location, f"unsafe repository path {raw!r}")
        return None
    return path


def resolve_reference(
    base: Path, raw: Any, location: str, report: Report
) -> Path | None:
    relative = safe_repo_path(raw, location, report)
    if relative is None:
        return None
    return base.joinpath(*relative.parts)


def validate_course(course_root: Path, report: Report) -> None:
    path = course_root / "course.yaml"
    manifest = load_yaml(path, report)
    if manifest is None:
        return
    require_fields(manifest, COURSE_REQUIRED, "course.yaml", report)
    require_int(manifest, "sort", "course.yaml", report)

    course_aliases = {
        "columnId": "column_id",
        "questionBankId": "question_bank_id",
        "questionBanks": "question_banks",
        "coverUrl": "cover_url",
        "homeBannerPoints": "home_banner_points",
    }
    for alias, canonical in course_aliases.items():
        if alias in manifest:
            report.error("course.yaml", f"use canonical field {canonical!r}, not {alias!r}")
    if "lessons" in manifest:
        report.error(
            "course.yaml",
            "remove 'lessons'; the root lesson.yaml is the only lesson registry",
        )
    if "supported_languages" in manifest:
        report.error(
            "course.yaml",
            "remove 'supported_languages'; language variants are stored on branches",
        )
    if "tags" in manifest and (
        not isinstance(manifest["tags"], list)
        or not all(isinstance(item, str) for item in manifest["tags"])
    ):
        report.error("course.yaml", "'tags' must be a list of strings")

    banks = manifest.get("question_banks")
    if banks is None:
        banks = []
    if not isinstance(banks, list):
        report.error("course.yaml", "'question_banks' must be a list")
        return

    bank_ids: set[str] = set()
    for index, bank in enumerate(banks):
        location = f"course.yaml.question_banks[{index}]"
        if not isinstance(bank, dict):
            report.error(location, "entry must be a mapping")
            continue
        bank_id = str(bank.get("id") or "").strip()
        if not bank_id:
            report.error(location, "missing required field 'id'")
        elif bank_id in bank_ids:
            report.error(location, f"duplicate question bank id {bank_id!r}")
        else:
            bank_ids.add(bank_id)
        if bank.get("path"):
            referenced = resolve_reference(course_root, bank["path"], f"{location}.path", report)
            if referenced is not None and not referenced.is_file():
                report.error(f"{location}.path", f"referenced file does not exist: {bank['path']}")

    default_bank = manifest.get("question_bank_id")
    if default_bank is not None and str(default_bank) not in bank_ids:
        report.error(
            "course.yaml.question_bank_id",
            f"{default_bank!r} does not reference question_banks[].id",
        )


def canonical_index_subtask(subtask: dict[str, Any]) -> dict[str, Any]:
    return {key: subtask[key] for key in INDEX_SUBTASK_FIELDS if subtask.get(key) is not None}


def validate_subtask(
    subtask: Any,
    index: int,
    task_dir: Path,
    task_location: str,
    report: Report,
) -> dict[str, Any] | None:
    location = f"{task_location}.subtasks[{index}]"
    if not isinstance(subtask, dict):
        report.error(location, "entry must be a mapping")
        return None
    require_fields(subtask, SUBTASK_REQUIRED, location, report)
    require_int(subtask, "sort", location, report)
    require_int(subtask, "status", location, report)

    subtask_type = str(subtask.get("type") or "").strip()
    if subtask_type == "code_maieutic":
        report.error(location, "type 'code_maieutic' is rejected; use 'code_practice'")
    source_aliases = {
        "iframeSrc": "iframe_src",
        "experimentId": "experiment_id",
        "labTaskId": "lab_task_id",
        "audioUrl": "audio_url",
        "labResourcePath": "lab_resource_path",
        "repoSync": "repo_sync",
    }
    for alias, canonical in source_aliases.items():
        if alias in subtask:
            report.error(location, f"use canonical field {canonical!r}, not {alias!r}")

    if "assistantPrompt" in subtask:
        report.warning(location, "'assistantPrompt' is not read by the Git parser")
    for ignored in ("start_time", "end_time"):
        if ignored in subtask:
            report.error(location, f"{ignored!r} is not read by the Git parser")

    referenced: Path | None = None
    if subtask.get("file"):
        referenced = resolve_reference(task_dir, subtask["file"], f"{location}.file", report)
        if referenced is not None and not referenced.is_file():
            report.error(f"{location}.file", f"referenced file does not exist: {subtask['file']}")

    metadata = subtask.get("metadata")
    if metadata is not None and not isinstance(metadata, dict):
        report.error(f"{location}.metadata", "must be a mapping")
        metadata = {}
    metadata = metadata or {}

    if subtask_type == "markdown":
        if not subtask.get("md") and referenced is None:
            report.error(location, "markdown requires 'file' or inline 'md'")
        elif referenced is not None and referenced.suffix.lower() != ".md":
            report.error(location, "markdown 'file' must end in .md")

    if subtask_type == "quiz":
        file_metadata = None
        if referenced is not None:
            if not referenced.name.endswith(".quiz.json"):
                report.error(location, "quiz 'file' must end in .quiz.json")
            elif referenced.is_file():
                file_metadata = derive_quiz_metadata(load_json(referenced, report))
        inline_metadata = (
            derive_quiz_metadata(subtask.get("question_json"))
            if subtask.get("question_json") is not None
            else None
        )
        metadata_authority = explicit_quiz_metadata(metadata)
        available = [
            value
            for value in (file_metadata, inline_metadata, metadata_authority)
            if value is not None
        ]
        if not available:
            report.error(
                location,
                "quiz requires one of .quiz.json, question_json, questionIds, or questionGroups",
            )
        elif any(value != available[0] for value in available[1:]):
            report.error(location, "quiz question sources contain conflicting IDs")
        elif len(available) > 1:
            report.warning(location, "quiz contains equivalent derived question metadata")

    if subtask_type in {"lab", "experiment", "notebook"}:
        lab_task_id = subtask.get("lab_task_id")
        if referenced is not None and referenced.name.lower().endswith((".lab.yaml", ".lab.yml")):
            lab_manifest = load_yaml(referenced, report)
            if lab_manifest is not None:
                lab_task_id = lab_task_id or lab_manifest.get("lab_task_id")
                if lab_manifest.get("experiment_id"):
                    report.error(
                        str(referenced.relative_to(task_dir)),
                        "'experiment_id' is historical; bind with 'lab_task_id'",
                    )
        if not lab_task_id:
            report.error(location, f"{subtask_type} requires an explicit 'lab_task_id'")
        if subtask.get("experiment_id"):
            report.error(location, "'experiment_id' is historical; use 'lab_task_id'")

    if subtask_type == "maic":
        if not subtask.get("iframe_src"):
            if subtask.get("classroom_id"):
                report.error(
                    location,
                    "'classroom_id' alone is not write-stable; use 'iframe_src'",
                )
            else:
                report.error(location, "maic requires 'iframe_src'")

    if subtask_type == "document":
        has_object = bool(metadata.get("object_key"))
        if not has_object and referenced is None and not subtask.get("url"):
            report.error(location, "document requires file, url, or metadata.object_key")

    report.counts["subtasks"] += 1
    return subtask


def validate_task(
    course_root: Path,
    lesson_path: PurePosixPath,
    task_index: dict[str, Any],
    task_index_location: str,
    report: Report,
) -> Path | None:
    task_relative = safe_repo_path(
        task_index.get("path"), f"{task_index_location}.path", report
    )
    if task_relative is None:
        return None
    expected_prefix = lesson_path.parts + ("tasks",)
    if (
        task_relative.parts[: len(expected_prefix)] != expected_prefix
        or len(task_relative.parts) != len(expected_prefix) + 1
    ):
        report.error(
            f"{task_index_location}.path",
            "task path must be exactly lessons/<lesson>/tasks/<task>",
        )
    if task_relative.parts[: len(lesson_path.parts)] != lesson_path.parts:
        report.error(
            f"{task_index_location}.path",
            "task path must be inside its lesson path",
        )
    task_dir = course_root.joinpath(*task_relative.parts)
    task_path = task_dir / "task.yaml"
    task_manifest = load_yaml(task_path, report)
    if task_manifest is None:
        return None

    relative_task_path = task_path.relative_to(course_root).as_posix()
    require_fields(task_manifest, TASK_REQUIRED, relative_task_path, report)
    require_int(task_manifest, "sort", relative_task_path, report)
    require_int(task_manifest, "status", relative_task_path, report)

    if str(task_manifest.get("id")) != str(task_index.get("id")):
        report.error(task_index_location, "id differs from task.yaml")
    for field_name in ("title", "status", "sort"):
        if task_manifest.get(field_name) != task_index.get(field_name):
            report.error(
                task_index_location,
                f"{field_name} differs from task.yaml",
            )
    for ignored in ("start_time", "end_time"):
        if ignored in task_manifest:
            report.error(relative_task_path, f"{ignored!r} is not read by the Git parser")
    if "assistantPrompt" in task_manifest:
        report.warning(relative_task_path, "'assistantPrompt' is not read by the Git parser")

    raw_subtasks = task_manifest.get("subtasks")
    if not isinstance(raw_subtasks, list):
        report.error(relative_task_path, "'subtasks' must be a list")
        raw_subtasks = []
    task_subtasks: list[dict[str, Any]] = []
    subtask_ids: set[str] = set()
    for index, raw_subtask in enumerate(raw_subtasks):
        subtask = validate_subtask(raw_subtask, index, task_dir, relative_task_path, report)
        if subtask is None:
            continue
        subtask_id = str(subtask.get("id") or "")
        if subtask_id in subtask_ids:
            report.error(
                f"{relative_task_path}.subtasks[{index}]",
                f"duplicate subtask id {subtask_id!r}",
            )
        subtask_ids.add(subtask_id)
        task_subtasks.append(canonical_index_subtask(subtask))

    index_subtasks = task_index.get("subtasks")
    if not isinstance(index_subtasks, list):
        if "subtasks" in task_index:
            report.error(task_index_location, "'subtasks' must be a list")
    else:
        task_subtasks.sort(key=lambda item: item.get("sort", 0))
        normalized_index = [
            canonical_index_subtask(item) if isinstance(item, dict) else item
            for item in index_subtasks
        ]
        normalized_index.sort(
            key=lambda item: item.get("sort", 0) if isinstance(item, dict) else 0
        )
        if normalized_index != task_subtasks:
            report.error(
                task_index_location,
                "subtask navigation metadata differs from task.yaml",
            )

    report.counts["tasks"] += 1
    return task_path


def validate_repository_layout(course_root: Path, report: Report) -> None:
    lessons_root = course_root / "lessons"
    if not lessons_root.is_dir():
        return

    for stale in sorted(lessons_root.glob("*/lesson.yaml")):
        report.error(
            stale.relative_to(course_root).as_posix(),
            "per-lesson lesson.yaml is a stale second authority; remove it",
        )

    for task_manifest in sorted(lessons_root.rglob("task.yaml")):
        relative = task_manifest.relative_to(course_root)
        parts = relative.parts
        if len(parts) != 5 or parts[0] != "lessons" or parts[2] != "tasks":
            report.error(
                relative.as_posix(),
                "task.yaml must be located at lessons/<lesson>/tasks/<task>/task.yaml",
            )


def validate_lessons(course_root: Path, report: Report) -> None:
    lesson_index_path = course_root / "lesson.yaml"
    manifest = load_yaml(lesson_index_path, report)
    if manifest is None:
        return
    lessons = manifest.get("lessons")
    if not isinstance(lessons, list):
        report.error("lesson.yaml", "'lessons' must be a list")
        return

    indexed_tasks: set[Path] = set()
    lesson_ids: set[str] = set()
    task_ids: set[str] = set()
    lesson_dirs: set[Path] = set()
    for lesson_index, lesson in enumerate(lessons):
        location = f"lesson.yaml.lessons[{lesson_index}]"
        if not isinstance(lesson, dict):
            report.error(location, "entry must be a mapping")
            continue
        require_fields(lesson, LESSON_REQUIRED, location, report)
        require_int(lesson, "sort", location, report)
        require_int(lesson, "status", location, report)
        lesson_id = str(lesson.get("id") or "")
        if lesson_id in lesson_ids:
            report.error(location, f"duplicate lesson id {lesson_id!r}")
        lesson_ids.add(lesson_id)

        lesson_path = safe_repo_path(lesson.get("path"), f"{location}.path", report)
        if lesson_path is None:
            continue
        lesson_dirs.add(course_root.joinpath(*lesson_path.parts))
        tasks = lesson.get("tasks")
        if not isinstance(tasks, list):
            report.error(location, "'tasks' must be a list")
            continue
        for task_index, task in enumerate(tasks):
            task_location = f"{location}.tasks[{task_index}]"
            if not isinstance(task, dict):
                report.error(task_location, "entry must be a mapping")
                continue
            require_fields(task, TASK_INDEX_REQUIRED, task_location, report)
            require_int(task, "sort", task_location, report)
            require_int(task, "status", task_location, report)
            task_id = str(task.get("id") or "")
            if task_id in task_ids:
                report.error(task_location, f"duplicate course-wide task id {task_id!r}")
            task_ids.add(task_id)
            task_path = validate_task(
                course_root, lesson_path, task, task_location, report
            )
            if task_path is not None:
                indexed_tasks.add(task_path.resolve())
        report.counts["lessons"] += 1

    all_task_manifests = {
        path.resolve() for path in (course_root / "lessons").glob("*/tasks/*/task.yaml")
    }
    for orphan in sorted(all_task_manifests - indexed_tasks):
        report.error(
            orphan.relative_to(course_root.resolve()).as_posix(),
            "task.yaml is not referenced by the root lesson.yaml",
        )

    for lesson_dir in lesson_dirs:
        tasks_dir = lesson_dir / "tasks"
        if not tasks_dir.is_dir():
            continue
        for task_dir in sorted(path for path in tasks_dir.iterdir() if path.is_dir()):
            if not (task_dir / "task.yaml").is_file():
                report.error(
                    task_dir.relative_to(course_root).as_posix(),
                    "task directory has no task.yaml",
                )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("course_root", type=Path)
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args()

    course_root = args.course_root.expanduser().resolve()
    report = Report()
    if not course_root.is_dir():
        report.error(str(course_root), "course root is not a directory")
    else:
        validate_course(course_root, report)
        validate_repository_layout(course_root, report)
        validate_lessons(course_root, report)

    payload = {
        "course_root": str(course_root),
        "valid": not report.errors,
        "counts": report.counts,
        "errors": report.errors,
        "warnings": report.warnings,
    }
    if args.as_json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        status = "PASS" if payload["valid"] else "FAIL"
        print(
            f"{status}: {course_root} "
            f"({report.counts['lessons']} lessons, "
            f"{report.counts['tasks']} tasks, "
            f"{report.counts['subtasks']} subtasks)"
        )
        for error in report.errors:
            print(f"ERROR: {error}")
        for warning in report.warnings:
            print(f"WARNING: {warning}")
    return 0 if payload["valid"] else 1


if __name__ == "__main__":
    sys.exit(main())
