#!/usr/bin/env python3
"""Lightweight audit for course-builder Markdown learning files."""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path


REQUIRED_HEADINGS = [
    "本页学完你要能做什么",
    "为什么要学",
    "苏格拉底引导问题",
    "参考资料",
    "核心概念",
    "图示与配图",
    "最小可运行示例",
    "学生练习",
    "常见错误与排查",
    "提交物与验收",
    "自检题",
    "和下一节的关系",
]

RED_FLAGS = [
    "学生理解",
    "学生掌握",
    "学生了解",
    "教师讲解",
    "参考资料自行阅读",
    "完成实验并截图",
    "根据实际情况调整",
    "待补充",
    "怎么做 | 设计",
    "怎么做 | 实现",
    "怎么做 | 完成",
    "完成本任务产物",
]

SOURCE_HINTS = [
    "github.com",
    ".md",
    ".py",
    ".ipynb",
    "docs/",
    "code/",
    "content/",
    "http://",
    "https://",
]

TECH_CITATION_HINTS = [
    "具体位置",
    "学生如何核查",
    "函数",
    "代码行",
    "Notebook",
    "commit",
    "URL",
]

WHY_WHAT_HOW_HINTS = [
    "为什么学",
    "学什么",
    "怎么做",
]

SOCRATIC_HINTS = [
    "观察",
    "解释",
    "证据",
    "边界",
    "迁移",
]

VISUAL_HINTS = [
    "图片 prompt",
    "alt 文本",
    "图片路径",
    "不需要配图",
    "无需配图",
]

ACTION_HINTS = [
    "修改",
    "运行",
    "提交",
    "记录",
    "判断",
    "比较",
    "验证",
    "定位",
    "解释",
    "改写",
]

EVIDENCE_HINTS = [
    "日志",
    "Trace",
    "JSON",
    "截图",
    "报告",
    "测试",
    "输出",
    "文件",
    "runs.jsonl",
]

INTERNAL_CARD_HINTS = [
    "Source Card",
    "Knowledge Card",
    "Evidence Card",
    "Pedagogy Card",
    "Technical Citation Card",
    "Visual Asset Card",
]


def section_block(text: str, heading: str) -> str:
    pattern = rf"^#+\s+[^\n]*{re.escape(heading)}[^\n]*\n(.*?)(^#+\s+|\Z)"
    match = re.search(pattern, text, flags=re.S | re.M)
    return match.group(1) if match else ""


def table_data_row_count(block: str) -> int:
    rows = []
    for line in block.splitlines():
        stripped = line.strip()
        if not stripped.startswith("|") or not stripped.endswith("|"):
            continue
        if re.fullmatch(r"\|?[\s:\-|]+\|?", stripped):
            continue
        rows.append(stripped)
    # subtract one header row when present
    return max(len(rows) - 1, 0)


def numbered_or_table_steps(block: str) -> int:
    numbered = len(re.findall(r"^\s*\d+[.)]\s+", block, flags=re.M))
    if numbered:
        return numbered
    return table_data_row_count(block)


def code_blocks(text: str) -> list[str]:
    return re.findall(r"```[a-zA-Z0-9_-]*\n(.*?)```", text, flags=re.S)


def looks_like_path_only(block: str) -> bool:
    lines = [line.strip() for line in block.splitlines() if line.strip()]
    if not lines:
        return False
    pathish = 0
    for line in lines:
        if re.fullmatch(r"[-\w./{}]+(?:\.[A-Za-z0-9]+)?", line):
            pathish += 1
    return pathish == len(lines)


def short_how_to_rows(text: str) -> list[str]:
    bad: list[str] = []
    for match in re.finditer(r"^\|\s*怎么做\s*\|\s*([^|]+?)\s*\|", text, flags=re.M):
        answer = match.group(1).strip()
        if len(answer) < 45 or answer in {"设计", "实现", "完成", "运行", "提交"}:
            bad.append(answer)
    return bad


def has_heading(text: str, heading: str) -> bool:
    pattern = rf"^#+\s+[^\n]*{re.escape(heading)}[^\n]*$"
    return re.search(pattern, text, flags=re.MULTILINE) is not None


def count_self_check_items(text: str) -> int:
    match = re.search(r"^#+\s+[^\n]*自检题[^\n]*\n(.*?)(^#+\s+|\Z)", text, re.S | re.M)
    if not match:
        return 0
    block = match.group(1)
    return len(re.findall(r"^\s*(?:[-*]|\d+[.)])\s+", block, flags=re.M))


def audit(path: Path) -> tuple[int, list[str], list[str]]:
    text = path.read_text(encoding="utf-8")
    errors: list[str] = []
    warnings: list[str] = []

    if len(text.strip()) < 3200:
        errors.append("内容过短，通常不足以形成饱满学习文件。")

    missing = [h for h in REQUIRED_HEADINGS if not has_heading(text, h)]
    if missing:
        errors.append("缺少必要标题：" + "、".join(missing))

    flags = [flag for flag in RED_FLAGS if flag in text]
    if re.search(r"(?m)^\s*(?:[-*]\s*)?略[。.]?\s*$", text):
        flags.append("略")
    if flags:
        warnings.append("发现空泛或禁用表述：" + "、".join(flags))

    internal = [hint for hint in INTERNAL_CARD_HINTS if hint in text]
    if internal:
        errors.append("学生可见学习文件出现内部研发卡名称：" + "、".join(internal))

    if not any(hint in text for hint in SOURCE_HINTS):
        errors.append("未发现具体参考来源路径、URL、代码文件或 Notebook。")

    if not all(hint in text for hint in WHY_WHAT_HOW_HINTS):
        errors.append("未完整回答为什么学、学什么、怎么做。")

    bad_how = short_how_to_rows(text)
    if bad_how:
        errors.append("“怎么做”过短或空泛，必须展开为 5-8 个可执行步骤：" + "；".join(bad_how[:3]))

    if not any(hint in text for hint in ["失败样例", "失败输入", "失败输出", "坏在哪里", "不学"]):
        errors.append("未发现具体失败样例或失败后果说明。")

    if not any(hint in text for hint in TECH_CITATION_HINTS):
        errors.append("未发现详细技术引用字段，如具体位置、学生如何核查、函数、代码行或 commit。")

    if sum(1 for hint in SOCRATIC_HINTS if hint in text) < 3:
        errors.append("苏格拉底引导问题不足，需覆盖观察、解释、证据、边界或迁移中的至少 3 类。")

    if not any(hint in text for hint in VISUAL_HINTS):
        errors.append("未发现配图决策、图片 prompt、alt 文本或不需要配图的理由。")

    blocks = code_blocks(text)
    if "```" not in text and "|" not in text:
        errors.append("未发现代码块或结构化表格，缺少可操作示例。")
    elif blocks and all(looks_like_path_only(block) for block in blocks):
        errors.append("代码块只包含文件名或路径，没有展示 Prompt、JSON、代码、命令、输入输出或 Trace。")
    elif any(looks_like_path_only(block) for block in blocks):
        warnings.append("发现只含文件名或路径的代码块，确认它不是用来冒充示例。")

    if not any(hint in text for hint in ACTION_HINTS):
        errors.append("未发现明确学生动作，如修改、运行、提交、判断、验证。")

    if not any(hint in text for hint in EVIDENCE_HINTS):
        errors.append("未发现明确提交证据，如日志、Trace、JSON、截图、报告。")

    if count_self_check_items(text) < 3:
        errors.append("自检题少于 3 题。")

    concept_block = section_block(text, "核心概念")
    if concept_block and table_data_row_count(concept_block) < 2:
        errors.append("核心概念少于 2 个，或没有拆到可教学粒度。")

    demo_block = section_block(text, "教师示范")
    if demo_block and numbered_or_table_steps(demo_block) < 4:
        errors.append("教师示范步骤少于 4 步，无法支撑学生照做。")

    exercise_block = section_block(text, "学生练习")
    if exercise_block and len(exercise_block.strip()) < 120:
        errors.append("学生练习过短，缺少修改对象、运行方式、观察点或提交证据。")

    error_block = section_block(text, "常见错误")
    if error_block and table_data_row_count(error_block) < 3:
        errors.append("常见错误少于 3 个。")

    deliver_block = section_block(text, "提交物与验收")
    if deliver_block and table_data_row_count(deliver_block) < 2:
        errors.append("提交物与验收少于 2 项，证据链不足。")

    nonempty = [line for line in text.splitlines() if line.strip()]
    table_lines = [line for line in nonempty if line.strip().startswith("|")]
    if nonempty and len(table_lines) / len(nonempty) > 0.55:
        warnings.append("表格占比过高，需确认不是用表格替代讲解、示范和练习。")

    score = 10 - len(errors) * 2 - len(warnings)
    score = max(score, 0)
    return score, errors, warnings


def repeated_blocks(paths: list[Path], minimum_length: int = 100) -> list[tuple[str, list[Path]]]:
    owners: dict[str, list[Path]] = defaultdict(list)
    for path in paths:
        text = path.read_text(encoding="utf-8")
        for block in (item.strip() for item in text.split("\n\n")):
            if len(block) >= minimum_length and path not in owners[block]:
                owners[block].append(path)
    return [
        (block, block_paths)
        for block, block_paths in owners.items()
        if len(block_paths) > 1
    ]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+", help="Markdown files to audit")
    args = parser.parse_args()

    paths = [Path(raw) for raw in args.paths]
    failed = False
    for path in paths:
        score, errors, warnings = audit(path)
        print(f"\n# {path}")
        print(f"score: {score}/10")
        if errors:
            failed = True
            print("errors:")
            for item in errors:
                print(f"- {item}")
        if warnings:
            print("warnings:")
            for item in warnings:
                print(f"- {item}")
        if not errors and not warnings:
            print("ok")

    duplicates = repeated_blocks(paths) if len(paths) > 1 else []
    if duplicates:
        failed = True
        print("\n# Cross-file duplicate blocks")
        print(f"errors: {len(duplicates)} repeated blocks of at least 100 characters")
        for block, block_paths in duplicates:
            preview = re.sub(r"\s+", " ", block)[:160]
            print(f"- {preview}")
            for path in block_paths:
                print(f"  - {path}")

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
