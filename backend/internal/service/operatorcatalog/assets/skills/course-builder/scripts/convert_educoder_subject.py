#!/usr/bin/env python3
"""Convert an exported Educoder/Oilan 1.0 subject into canonical Course Git."""

from __future__ import annotations

import argparse
import json
import re
import shutil
from datetime import date
from pathlib import Path
from typing import Any

import yaml


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def write_yaml(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        yaml.safe_dump(value, allow_unicode=True, sort_keys=False, width=100),
        encoding="utf-8",
    )


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def clean_text(value: Any) -> str:
    return str(value or "").strip()


def safe_component(value: Any, fallback: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9_.-]+", "-", clean_text(value)).strip("-._").lower()
    return normalized[:48] or fallback


def rewrite_attachments(
    text: str,
    attachment_map: dict[str, str],
    missing_attachment_urls: list[str],
    prefix: str = "../../../../../",
) -> str:
    result = re.sub(r"\[([^\]]+)\]\(TOC\)", r"**\1**", text, flags=re.IGNORECASE)
    missing_notes = {}
    for index, old_url in enumerate(
        sorted(missing_attachment_urls, key=len, reverse=True),
        1,
    ):
        placeholder = f"@@MISSING_SOURCE_ATTACHMENT_{index:03d}@@"
        missing_notes[placeholder] = (
            f"> Source attachment unavailable in Oilan 1.0: `{old_url}`"
        )
        escaped = re.escape(old_url)
        result = re.sub(
            rf"<(?:img|video)\b[^>]*\bsrc=[\"']{escaped}\)?[\"'][^>]*>(?:</video>)?",
            f"\n{placeholder}\n",
            result,
            flags=re.IGNORECASE,
        )
        result = re.sub(
            rf"!\[[^\]]*\]\(\s*{escaped}\)?(?:\s+[^)]*)?\)",
            f"\n{placeholder}\n",
            result,
        )
        result = result.replace(old_url, placeholder)
    for old_url in sorted(attachment_map, key=len, reverse=True):
        replacement = f"{prefix}{attachment_map[old_url]}"
        escaped = re.escape(old_url)
        result = re.sub(
            rf"<img\b[^>]*\bsrc=[\"']{escaped}\)?[\"'][^>]*>",
            f"\n![]({replacement})\n",
            result,
            flags=re.IGNORECASE,
        )
        result = re.sub(
            rf"<video\b[^>]*\bsrc=[\"']{escaped}\)?[\"'][^>]*>(?:.*?</video>)?",
            f"\n[Video]({replacement})\n",
            result,
            flags=re.IGNORECASE | re.DOTALL,
        )
        result = re.sub(
            rf"<source\b[^>]*\bsrc=[\"']{escaped}\)?[\"'][^>]*>",
            f"\n[Media]({replacement})\n",
            result,
            flags=re.IGNORECASE,
        )
        result = result.replace(f'{old_url})"', f'{replacement}"')
        result = result.replace(old_url, replacement)
    for placeholder, note in missing_notes.items():
        result = result.replace(placeholder, note)
    return result


def fenced(value: Any, language: str = "text") -> str:
    text = str(value or "")
    fence = "```"
    while fence in text:
        fence += "`"
    return f"{fence}{language}\n{text}\n{fence}"


def code_challenge_markdown(
    challenge: dict[str, Any],
    attachment_map: dict[str, str],
    missing_attachment_urls: list[str],
) -> str:
    parts = [f"# {clean_text(challenge.get('subject')) or 'Practice'}"]
    body = rewrite_attachments(
        clean_text(challenge.get("task_pass")),
        attachment_map,
        missing_attachment_urls,
    )
    if body:
        parts.append(body)

    test_sets = challenge.get("test_sets") or []
    public_test_sets = [
        test_set
        for test_set in test_sets
        if bool(test_set.get("is_public")) and not bool(test_set.get("is_invisible"))
    ]
    if public_test_sets:
        parts.append("## Тексеру деректері")
        for index, test_set in enumerate(public_test_sets, 1):
            score = test_set.get("score")
            parts.append(f"### Test set {index} (public, score {score})")
            if clean_text(test_set.get("input")):
                parts.extend(["**Input**", fenced(test_set.get("input"))])
            parts.extend(["**Expected output**", fenced(test_set.get("output"))])
    return "\n\n".join(parts)


def choice_challenge_markdown(
    challenge: dict[str, Any],
    attachment_map: dict[str, str],
    missing_attachment_urls: list[str],
) -> str:
    parts = [f"# {clean_text(challenge.get('subject')) or 'Quiz'}"]
    body = rewrite_attachments(
        clean_text(challenge.get("task_pass")),
        attachment_map,
        missing_attachment_urls,
    )
    if body:
        parts.append(body)

    choices = challenge.get("choices") or []
    parts.append("## Сұрақтар")
    for index, choice in enumerate(choices, 1):
        parts.append(f"### {index}. {clean_text(choice.get('subject'))}")
        options = choice.get("options") or []
        for option_index, option in enumerate(options):
            label = chr(ord("A") + option_index)
            parts.append(f"- {label}. {clean_text(option.get('option_name'))}")
        score = choice.get("score")
        if score is not None:
            parts.append(f"**Ұпай:** {score}")
    return "\n\n".join(parts)


def task_content(
    shixun: dict[str, Any],
    attachment_map: dict[str, str],
    missing_attachment_urls: list[str],
) -> str:
    parts = [
        clean_text(shixun.get("description")),
        clean_text(shixun.get("propaedeutics")),
    ]
    value = "\n\n".join(part for part in parts if part)
    return rewrite_attachments(
        value or clean_text(shixun.get("name")),
        attachment_map,
        missing_attachment_urls,
        "",
    )


def detected_extension(path: Path) -> str:
    header = path.read_bytes()[:16]
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if header.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if header.startswith((b"GIF87a", b"GIF89a")):
        return ".gif"
    if header.startswith(b"%PDF-"):
        return ".pdf"
    if len(header) >= 12 and header[4:8] == b"ftyp":
        return ".mp4"
    if header.startswith(b"RIFF") and header[8:12] == b"WEBP":
        return ".webp"
    return path.suffix.lower() or ".bin"


def normalized_attachment_map(
    source_assets: Path,
    attachment_map: dict[str, str],
) -> tuple[dict[str, str], list[str]]:
    normalized = {}
    missing = []
    for old_url, relative in attachment_map.items():
        source = source_assets / Path(relative).name
        if source.suffix.lower() == ".bin":
            try:
                response = json.loads(source.read_text(encoding="utf-8"))
            except (UnicodeError, json.JSONDecodeError):
                response = None
            if isinstance(response, dict) and int(response.get("status") or 0) != 0:
                missing.append(old_url)
                continue
        extension = detected_extension(source)
        normalized[old_url] = f"assets/attachments/{source.stem}{extension}"
    return normalized, missing


def migration_category(shixun: dict[str, Any], challenge: dict[str, Any]) -> str:
    if int(challenge.get("st") or 0) == 1:
        return "choice_question_archive"
    if challenge.get("unity_3d"):
        return "unity3d_source_practice"
    if shixun.get("is_jupyter") or shixun.get("is_jupyter_lab"):
        return "jupyter_source_practice"
    if shixun.get("repo_name"):
        return "code_source_practice"
    return "text_source_practice"


def copy_assets(
    source_assets: Path,
    output: Path,
    payload: dict[str, Any],
    attachment_map: dict[str, str],
) -> str | None:
    attachment_target = output / "assets" / "attachments"
    attachment_target.mkdir(parents=True, exist_ok=True)
    source_map = payload.get("attachment_map", {})
    for old_url, relative in attachment_map.items():
        source = source_assets / Path(source_map[old_url]).name
        if not source.is_file():
            raise FileNotFoundError(f"exported attachment does not exist: {source}")
        shutil.copy2(source, attachment_target / Path(relative).name)

    cover_url = None
    for index, attachment in enumerate(payload.get("subject_attachments") or [], 1):
        exported_name = clean_text(attachment.get("exported_file_name"))
        source = source_assets / exported_name
        if not source.is_file():
            raise FileNotFoundError(f"subject attachment does not exist: {source}")
        extension = source.suffix.lower() or ".bin"
        target_name = "cover-course" + extension if index == 1 else f"subject-attachment-{index:02d}{extension}"
        target = output / "assets" / "images" / target_name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        if index == 1:
            cover_url = f"assets/images/{target_name}"
    return cover_url


def build_course(args: argparse.Namespace) -> dict[str, int]:
    payload = json.loads(Path(args.source_json).read_text(encoding="utf-8"))
    source_assets = Path(args.source_assets)
    output = Path(args.output)
    if output.exists() and any(output.iterdir()):
        raise RuntimeError(f"output directory is not empty: {output}")
    output.mkdir(parents=True, exist_ok=True)

    subject = payload["subject"]
    stages = payload.get("stages") or []
    attachment_map, detected_missing_attachments = normalized_attachment_map(
        source_assets,
        payload.get("attachment_map") or {},
    )
    missing_attachment_urls = [
        clean_text(item.get("url"))
        for item in payload.get("missing_attachment_urls") or []
        if isinstance(item, dict) and clean_text(item.get("url"))
    ]
    missing_attachment_urls.extend(detected_missing_attachments)
    missing_attachment_urls = list(dict.fromkeys(missing_attachment_urls))
    cover_url = copy_assets(source_assets, output, payload, attachment_map)

    counts = {
        "lessons": 0,
        "tasks": 0,
        "subtasks": 0,
        "choices": 0,
        "public_test_sets": 0,
        "hidden_test_sets_omitted": 0,
        "reference_answers_omitted": 0,
        "choice_answers_omitted": 0,
    }
    lesson_index: list[dict[str, Any]] = []
    package_lessons: list[dict[str, Any]] = []
    task_map_rows = []

    for lesson_number, stage in enumerate(stages, 1):
        lesson_id = f"lesson_{lesson_number:02d}"
        lesson_dir = f"lessons/lesson-{lesson_number:02d}"
        indexed_tasks = []
        package_tasks = []

        for task_number, shixun in enumerate(stage.get("shixuns") or [], 1):
            identifier = safe_component(shixun.get("identifier"), f"shixun-{shixun['id']}")
            task_id = f"task_{lesson_number:02d}_{task_number:02d}_{identifier}"
            task_dir = f"{lesson_dir}/tasks/task-{lesson_number:02d}-{task_number:02d}-{identifier}"
            indexed_subtasks = []
            task_subtasks = []
            package_subtasks = []

            for challenge_number, challenge in enumerate(shixun.get("challenges") or [], 1):
                subtask_id = f"{task_id}_challenge_{challenge_number:02d}"
                file_name = f"challenge-{challenge_number:02d}.md"
                relative_file = f"{task_dir}/subtasks/{file_name}"
                is_choice = int(challenge.get("st") or 0) == 1
                markdown = (
                    choice_challenge_markdown(
                        challenge,
                        attachment_map,
                        missing_attachment_urls,
                    )
                    if is_choice
                    else code_challenge_markdown(
                        challenge,
                        attachment_map,
                        missing_attachment_urls,
                    )
                )
                write_text(output / relative_file, markdown)
                category = migration_category(shixun, challenge)
                test_sets = challenge.get("test_sets") or []
                public_test_sets = [
                    test_set
                    for test_set in test_sets
                    if bool(test_set.get("is_public")) and not bool(test_set.get("is_invisible"))
                ]
                hidden_test_sets = len(test_sets) - len(public_test_sets)
                reference_answers = len(challenge.get("answers") or [])
                choice_answers = sum(
                    bool(clean_text(choice.get("standard_answer") or choice.get("answer")))
                    for choice in challenge.get("choices") or []
                )
                metadata = {
                    "source_platform": "oilan1.0",
                    "source_shixun_id": str(shixun["id"]),
                    "source_challenge_id": str(challenge["id"]),
                    "migration_category": category,
                    "testset_count": len(challenge.get("test_sets") or []),
                    "public_testset_count": len(public_test_sets),
                    "hidden_testset_count_omitted": hidden_test_sets,
                    "reference_answer_count_omitted": reference_answers,
                    "choice_answer_count_omitted": choice_answers,
                    "choice_count": len(challenge.get("choices") or []),
                }
                common = {
                    "id": subtask_id,
                    "title": clean_text(challenge.get("subject")) or f"Challenge {challenge_number}",
                    "category": "practice",
                    "type": "markdown",
                    "duration": max(15, int(challenge.get("exec_time") or 30)),
                    "completed": False,
                    "status": 1,
                    "sort": challenge_number,
                    "metadata": metadata,
                }
                indexed_subtasks.append(common)
                task_subtasks.append({**common, "file": f"subtasks/{file_name}"})
                package_subtasks.append(
                    {
                        **common,
                        "source": {"path": relative_file},
                    }
                )
                counts["subtasks"] += 1
                counts["choices"] += len(challenge.get("choices") or [])
                counts["public_test_sets"] += len(public_test_sets)
                counts["hidden_test_sets_omitted"] += hidden_test_sets
                counts["reference_answers_omitted"] += reference_answers
                counts["choice_answers_omitted"] += choice_answers
                task_map_rows.append(
                    (
                        lesson_number,
                        task_number,
                        clean_text(shixun.get("name")),
                        challenge_number,
                        clean_text(challenge.get("subject")),
                        category,
                    )
                )

            task_manifest = {
                "id": task_id,
                "title": clean_text(shixun.get("name")),
                "content": task_content(
                    shixun,
                    attachment_map,
                    missing_attachment_urls,
                ),
                "duration": max(30, sum(item["duration"] for item in task_subtasks)),
                "sort": task_number,
                "status": 1,
                "subtasks": task_subtasks,
            }
            write_yaml(output / task_dir / "task.yaml", task_manifest)
            indexed_tasks.append(
                {
                    **{key: value for key, value in task_manifest.items() if key != "subtasks"},
                    "path": task_dir,
                    "subtasks": indexed_subtasks,
                }
            )
            package_tasks.append(
                {
                    "id": task_id,
                    "title": task_manifest["title"],
                    "content": task_manifest["content"],
                    "type": "learning",
                    "duration": task_manifest["duration"],
                    "status": 1,
                    "sort": task_number,
                    "subtasks": package_subtasks,
                }
            )
            counts["tasks"] += 1

        lesson_manifest = {
            "id": lesson_id,
            "title": clean_text(stage.get("name")),
            "description": rewrite_attachments(
                clean_text(stage.get("description")),
                attachment_map,
                missing_attachment_urls,
                "",
            ),
            "status": 1,
            "sort": lesson_number,
            "tasks": indexed_tasks,
        }
        lesson_index.append({**lesson_manifest, "path": lesson_dir})
        package_lessons.append(
            {
                "id": lesson_id,
                "title": lesson_manifest["title"],
                "description": lesson_manifest["description"],
                "status": 1,
                "sort": lesson_number,
                "tasks": package_tasks,
            }
        )
        counts["lessons"] += 1

    course = {
        "id": args.repo_key.replace("-", "_"),
        "name": args.repo_key,
        "title": clean_text(subject.get("name")),
        "description": rewrite_attachments(
            clean_text(subject.get("description")) or clean_text(subject.get("name")),
            attachment_map,
            missing_attachment_urls,
            "",
        ),
        "type": "mixed",
        "column_id": args.column_id,
        "status": 1,
        "sort": 0,
        "default_language": "kk-KZ",
        "tags": ["Oilan", "kk-KZ", "EduCoder migration", "Artificial intelligence"],
        **({"cover_url": cover_url} if cover_url else {}),
        "metadata": {
            "source_platform": "oilan1.0",
            "source_path_identifier": clean_text(subject.get("identifier")),
            "source_subject_id": str(subject["id"]),
            "source_course_url": args.source_url,
            "migration_date": args.migration_date,
            "migration_scope": (
                f"{counts['lessons']} stages, {counts['tasks']} shixuns, "
                f"{counts['subtasks']} challenges, {counts['choices']} choice questions"
            ),
            "target_tenant_id": str(args.tenant_id),
        },
    }
    write_yaml(output / "course.yaml", course)
    write_yaml(output / "lesson.yaml", {"lessons": lesson_index})
    write_json(
        output / "course-package.json",
        {
            "schemaVersion": "zhiyong.course-package/v1",
            "projectId": args.repo_key,
            "course": {
                "title": course["title"],
                "description": course["description"],
                "type": course["type"],
                "columnSelector": args.column_id,
                **({"coverPath": cover_url} if cover_url else {}),
                "lessons": package_lessons,
            },
            "publication": {
                "requested": True,
                "status": "pending_credentials",
            },
        },
    )

    map_lines = ["# Legacy attachment map", "", "| Old URL | Course Git file |", "| --- | --- |"]
    map_lines.extend(f"| `{old}` | `{new}` |" for old, new in attachment_map.items())
    if missing_attachment_urls:
        map_lines.extend(["", "## Missing source attachments", ""])
        map_lines.extend(f"- `{url}`" for url in missing_attachment_urls)
    write_text(output / "resources" / "legacy" / "attachment-map.md", "\n".join(map_lines))

    report = [
        "# Migration report",
        "",
        f"- Source course: `{course['title']}`",
        f"- Source URL: {args.source_url}",
        f"- Source subject_id: `{subject['id']}`",
        f"- Target course repo key: `{args.repo_key}`",
        f"- Target tenant: `{args.tenant_id}` (Oilan 2.0)",
        f"- Generated at: {args.migration_date}",
        "",
        "## Coverage",
        "",
        f"- Lessons migrated: {counts['lessons']}/{len(stages)}",
        f"- Tasks migrated: {counts['tasks']}/{sum(len(s.get('shixuns') or []) for s in stages)}",
        f"- Source challenges migrated as Markdown: {counts['subtasks']}/{counts['subtasks']}",
        f"- Source choice questions retained without correct answers: {counts['choices']}",
        f"- Public test sets retained: {counts['public_test_sets']}",
        f"- Hidden test sets omitted: {counts['hidden_test_sets_omitted']}",
        f"- Reference answers omitted: {counts['reference_answers_omitted']}",
        f"- Choice answers omitted: {counts['choice_answers_omitted']}",
        f"- Missing source attachments recorded without synthetic replacement: {len(missing_attachment_urls)}",
        "",
        "## Publication safety policy",
        "",
        "- Hidden tests, reference answers, correct choice answers, raw source JSON, and repository snapshots are excluded from Course Git.",
        "- Full-fidelity source exports remain only in the operator-controlled migration workspace.",
        "- No Oilan 2.0 LabTask or question-bank record is fabricated when an exact verified binding is absent.",
        "- Choice questions remain answer-free Markdown archives until imported through the authoritative question-bank API.",
        *(
            [
                "",
                "## Missing source attachments",
                "",
                *[f"- `{url}`" for url in missing_attachment_urls],
            ]
            if missing_attachment_urls
            else []
        ),
        "",
        "## Task map",
        "",
        "| Stage | Task | Source shixun | Challenge | Item | Migration category |",
        "| ---: | ---: | --- | ---: | --- | --- |",
    ]
    report.extend(
        f"| {stage} | {task} | {shixun} | {challenge} | {item} | {category} |"
        for stage, task, shixun, challenge, item, category in task_map_rows
    )
    write_text(output / "resources" / "legacy" / "migration-report.md", "\n".join(report))
    return counts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-json", required=True)
    parser.add_argument("--source-assets", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--repo-key", required=True)
    parser.add_argument("--column-id", required=True)
    parser.add_argument("--tenant-id", required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--migration-date", default=date.today().isoformat())
    args = parser.parse_args()
    print(json.dumps(build_course(args), ensure_ascii=False))


if __name__ == "__main__":
    main()
