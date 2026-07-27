from __future__ import annotations

import json
import math
import os
import re
import hashlib
import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from uuid import uuid4


DOAGENT_BASE_URL = os.environ.get("DOAGENT_BASE_URL", "http://127.0.0.1:7749").rstrip("/")
LEARNING_COMPANION_PORT = int(os.environ.get("LEARNING_COMPANION_PORT") or "8080")
DEFAULT_WORKSPACE_ROOT = os.environ.get("AI_WORKER_WORKSPACE_ROOT") or os.environ.get("AI_WORKER_CWD") or "/root/workspace"
DIALOGUE_WORKSPACE_ROOT = os.environ.get("AI_WORKER_DIALOGUE_WORKSPACE_ROOT") or "/tmp"
DEFAULT_STUDENT_ID = os.environ.get("LEARNING_COMPANION_STUDENT_ID") or os.environ.get("AI_WORKER_METADATA_STUDENT_ID") or "current-user"
PERSISTENT_TURN_TIMEOUT_SECONDS = int(os.environ.get("LEARNING_COMPANION_PERSISTENT_TURN_TIMEOUT_SECONDS") or "600")
PERSISTENT_STABILIZE_TIMEOUT_SECONDS = int(os.environ.get("LEARNING_COMPANION_PERSISTENT_STABILIZE_TIMEOUT_SECONDS") or "120")
PRACTICE_TURN_TIMEOUT_SECONDS = int(os.environ.get("LEARNING_COMPANION_PRACTICE_TURN_TIMEOUT_SECONDS") or str(PERSISTENT_TURN_TIMEOUT_SECONDS))
BUNDLED_SKILL_ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE_GRAPH_SKILL_ROOT = BUNDLED_SKILL_ROOT.parent / "knowledge-graph"
SYSTEM_PAGES = {
    "wiki/pages/graph/course_graph.md",
    "wiki/pages/graph/student_overlay.md",
    "wiki/pages/evaluation/metrics.md",
    "wiki/pages/evaluation/profile.md",
    "wiki/pages/memory/tree.md",
    "wiki/pages/memory/profile.md",
    "wiki/pages/memory/reflections.md",
}
MEMORY_PAGE_KEYS = {
    "memoryTree": "wiki/pages/memory/tree.md",
    "memoryProfile": "wiki/pages/memory/profile.md",
    "memoryReflections": "wiki/pages/memory/reflections.md",
}
MEMORY_PAGE_SPECS = {
    "memoryTree": {
        "title": "AI 学伴 - 记忆树",
        "summary": "学伴系统记忆树索引。",
    },
    "memoryProfile": {
        "title": "AI 学伴 - 学习者画像",
        "summary": "学伴学习者画像。",
    },
    "memoryReflections": {
        "title": "AI 学伴 - 学习反思",
        "summary": "学伴学习反思记录。",
    },
}
PATHS = {
    "rawCourse": "raw/course",
    "rawStudentEvents": "raw/student-events",
    "rawPractice": "raw/practice",
    "wiki": "wiki",
    "courseGraph": "wiki/pages/graph/course_graph.md",
    "studentOverlay": "wiki/pages/graph/student_overlay.md",
    "studentProfile": "wiki/pages/evaluation/profile.md",
    "evaluationMetrics": "wiki/pages/evaluation/metrics.md",
    "memoryTree": "wiki/pages/memory/tree.md",
    "memoryProfile": "wiki/pages/memory/profile.md",
    "memoryReflections": "wiki/pages/memory/reflections.md",
    "sessions": "sessions",
}
GROWTH_SECURITY_POLICY = {
    "version": "learning-companion-growth-security-v1",
    "computedBy": "learning-companion-worker",
    "trustedInputs": [
        "wiki/pages/notes/<knowledge-report>.md path",
        "wiki/pages/practice-sessions/<session-id>.md questions",
        "wiki/pages/practice-results/<attempt-id>.md score",
    ],
    "ignoredInputs": [
        "client submitted points",
        "client submitted emblems",
        "workspace metrics evidence points",
        "wiki document embedded points",
    ],
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class InvalidWikiJsonPayload(RuntimeError):
    def __init__(self, path: str):
        self.path = canonical_wiki_page_path(path)
        super().__init__(f"wiki page has invalid JSON payload: {self.path}")


def rpc(method: str, params: dict[str, Any] | None = None, timeout: float = 180.0) -> dict[str, Any]:
    payload = json.dumps({
        "jsonrpc": "2.0",
        "id": uuid4().hex,
        "method": method,
        "params": params or {},
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{DOAGENT_BASE_URL}/rpc",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8") or "{}")
    if isinstance(data, dict) and data.get("error"):
        error = data["error"]
        message = error.get("message") if isinstance(error, dict) else str(error)
        raise RuntimeError(message or f"doagent rpc failed: {method}")
    result = data.get("result") if isinstance(data, dict) else data
    return result if isinstance(result, dict) else {"result": result}


def is_transient_read_timeout(exc: BaseException) -> bool:
    if isinstance(exc, (socket.timeout, TimeoutError)):
        return True
    return isinstance(exc, OSError) and "timed out" in str(exc).lower()


def response_object_is_unreadable_after_timeout(exc: BaseException) -> bool:
    return "cannot read from timed out object" in str(exc).lower()


def is_send_ack_read_timeout(exc: BaseException) -> bool:
    cause = exc.__cause__
    return response_object_is_unreadable_after_timeout(exc) or (
        isinstance(cause, BaseException) and response_object_is_unreadable_after_timeout(cause)
    )


def send_doagent_chat_message(params: dict[str, Any], timeout: float = 180.0) -> dict[str, Any]:
    try:
        return rpc("chat/sendMessage", params, timeout=timeout)
    except Exception as exc:
        if response_object_is_unreadable_after_timeout(exc):
            raise TimeoutError("doagent chat/sendMessage response timed out before acknowledgement") from exc
        raise


def workspace_root() -> str:
    return DEFAULT_WORKSPACE_ROOT.rstrip("/") or "/root/workspace"


def dialogue_workspace_root() -> str:
    return DIALOGUE_WORKSPACE_ROOT.rstrip("/") or "/tmp"


def doagent_result_final_text(cwd: str, session_id: str) -> str:
    payload = doagent_result_payload(cwd, session_id)
    if not payload:
        return ""
    return extract_message_text(payload.get("finalText") or payload.get("message") or payload.get("content") or "")


def doagent_result_exists(cwd: str, session_id: str) -> bool:
    return doagent_result_payload(cwd, session_id) is not None


def doagent_result_payload(cwd: str, session_id: str) -> dict[str, Any] | None:
    result_path = Path(cwd) / ".agent" / "sessions" / session_id / "result.json"
    if not result_path.exists():
        return None
    try:
        payload = json.loads(result_path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def doagent_result_error_message(cwd: str, session_id: str) -> str:
    payload = doagent_result_payload(cwd, session_id)
    if not isinstance(payload, dict):
        return ""
    stop_reason = str(payload.get("stopReason") or "").strip().lower()
    failure_reason = extract_message_text(payload.get("failureReason") or "")
    failure_details = payload.get("failureDetails") if isinstance(payload.get("failureDetails"), dict) else {}
    detail_error = extract_message_text(failure_details.get("error") or "")
    final_text = doagent_result_final_text(cwd, session_id)
    if stop_reason == "error" or failure_reason or detail_error:
        return failure_reason or detail_error or final_text or "doagent turn failed"
    return ""


FORBIDDEN_PRACTICE_TOOL_NAMES = {"bash", "executecode", "python", "append", "edit"}
FORBIDDEN_PRACTICE_SESSION_TOOL_NAMES = FORBIDDEN_PRACTICE_TOOL_NAMES | {"list", "list_files"}
ABSOLUTE_PATH_KEYS = {"path", "file_path", "output_path", "cwd", "workspaceRoot", "workspace_root"}


def practice_session_tool_contract_error(session_id: str, intent: str | None = None) -> str | None:
    messages_path = Path(workspace_root()) / ".agent" / "sessions" / str(session_id or "") / "messages.json"
    if not messages_path.exists():
        return None
    try:
        messages = json.loads(messages_path.read_text(encoding="utf-8"))
    except Exception as exc:
        return f"practice task session log is unreadable: {exc}"
    if not isinstance(messages, list):
        return "practice task session log is invalid"
    for message in messages:
        if not isinstance(message, dict):
            continue
        for call in message.get("tool_calls") if isinstance(message.get("tool_calls"), list) else []:
            if not isinstance(call, dict):
                continue
            function = call.get("function") if isinstance(call.get("function"), dict) else {}
            tool_name = str(function.get("name") or "").strip()
            forbidden_tools = FORBIDDEN_PRACTICE_SESSION_TOOL_NAMES if intent == "practice_session" else FORBIDDEN_PRACTICE_TOOL_NAMES
            if tool_name.lower() in forbidden_tools:
                return f"practice task used forbidden tool {tool_name}"
            raw_arguments = function.get("arguments")
            try:
                arguments = json.loads(raw_arguments) if isinstance(raw_arguments, str) else raw_arguments
            except Exception:
                arguments = raw_arguments
            error = practice_tool_argument_contract_error(tool_name, arguments)
            if error:
                return error
    return None


def practice_tool_argument_contract_error(tool_name: str, arguments: Any) -> str | None:
    if isinstance(arguments, dict):
        for key, value in arguments.items():
            key_text = str(key)
            if key_text in ABSOLUTE_PATH_KEYS and isinstance(value, str) and value.startswith("/"):
                return f"practice task used absolute path in {tool_name or 'tool'} argument {key_text}"
            nested = practice_tool_argument_contract_error(tool_name, value)
            if nested:
                return nested
    elif isinstance(arguments, list):
        for value in arguments:
            nested = practice_tool_argument_contract_error(tool_name, value)
            if nested:
                return nested
    return None


def ensure_skill_registered(skill_name: str, skill_root: Path) -> str:
    skill_file = skill_root / "SKILL.md"
    if not skill_file.exists():
        raise RuntimeError(f"{skill_name} bundled skill is missing: {skill_file}")
    skills_dir = Path(workspace_root()) / ".agent" / "skills"
    skills_dir.mkdir(parents=True, exist_ok=True)
    link_path = skills_dir / skill_name
    expected_target = str(skill_root)
    if link_path.is_symlink():
        current_target = os.readlink(link_path)
        if current_target != expected_target:
            link_path.unlink()
            link_path.symlink_to(skill_root, target_is_directory=True)
    elif link_path.exists():
        if not (link_path / "SKILL.md").exists():
            raise RuntimeError(f"invalid {skill_name} skill registration: {link_path}")
    else:
        link_path.symlink_to(skill_root, target_is_directory=True)
    return str(link_path)


def ensure_runtime_skill_registered() -> tuple[str, str]:
    learning_companion = ensure_skill_registered("learning-companion", BUNDLED_SKILL_ROOT)
    knowledge_graph = ensure_skill_registered("knowledge-graph", KNOWLEDGE_GRAPH_SKILL_ROOT)
    return learning_companion, knowledge_graph


def workspace_params() -> dict[str, Any]:
    return {"workspaceRoot": workspace_root()}


def doagent_safe_context(context: dict[str, Any], extra: dict[str, Any] | None = None) -> dict[str, Any]:
    unsafe_keys = {"workspaceRoot", "workspace_root", "workspacePath", "workspace_path", "cwd", "root"}
    safe: dict[str, Any] = {}
    for key, value in (context or {}).items():
        if key in unsafe_keys:
            continue
        if isinstance(value, str) and value.startswith("/"):
            continue
        safe[key] = value
    safe.update(extra or {})
    safe["workspacePathMode"] = "relative"
    return safe


def looks_like_weakness_probe_request(text: str) -> bool:
    stripped = str(text or "").strip()
    if not stripped:
        return False
    has_probe_action = any(keyword in stripped for keyword in ("追问", "问一个问题", "先问问题", "先问一个问题", "诊断问题"))
    has_weakness_target = any(keyword in stripped for keyword in ("薄弱", "弱点", "错因", "最需要巩固", "当前最弱"))
    has_waiting_rule = any(keyword in stripped for keyword in ("不要直接讲答案", "不要直接给答案", "等我回答", "判断错因"))
    return has_probe_action and (has_weakness_target or has_waiting_rule)


def normalize_companion_intent(value: Any) -> str:
    intent = str(value or "").strip().lower().replace("-", "_")
    return intent if intent in {"query", "probe_weakness", "persistent_learning", "practice_review", "learn"} else ""


def looks_like_persistent_learning_request(text: str) -> bool:
    stripped = str(text or "").strip()
    if not stripped:
        return False
    if any(keyword in stripped for keyword in (
        "/learn",
        "请学习",
        "学会这批",
        "整理",
        "沉淀",
        "构建知识图谱",
        "录入",
        "喂知识",
        "出题",
        "练习题",
        "训练题",
        "测评",
        "知识测评",
        "批改",
        "提交答案",
        "重建",
        "重新构建",
    )):
        return True
    if any(mark in stripped for mark in ("?", "？")):
        return False
    learning_statement_markers = (
        "我刚学到",
        "刚学到",
        "我学到了",
        "学到了",
        "今天学了",
        "课堂笔记",
        "学习笔记",
        "知识点是",
        "请记住",
        "帮我记",
        "记录一下",
    )
    return len(stripped) >= 12 and any(marker in stripped for marker in learning_statement_markers)


def should_run_persistent_learning_task(prompt: str, companion_intent: str, is_weakness_probe: bool) -> bool:
    if companion_intent:
        return companion_intent == "persistent_learning"
    return looks_like_persistent_learning_request(prompt) and not is_weakness_probe


def workspace_dialogue_summary(snapshot: dict[str, Any]) -> dict[str, Any]:
    graph = snapshot.get("graph") if isinstance(snapshot.get("graph"), dict) else {}
    nodes = graph.get("nodes") if isinstance(graph.get("nodes"), list) else []
    documents = snapshot.get("documents") if isinstance(snapshot.get("documents"), list) else []
    metrics = snapshot.get("metrics") if isinstance(snapshot.get("metrics"), dict) else {}
    weak_nodes: list[dict[str, Any]] = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        mastery = node.get("mastery")
        if mastery is None:
            continue
        try:
            if float(mastery) >= 0.6:
                continue
        except (TypeError, ValueError):
            continue
        weak_nodes.append({
            "id": str(node.get("id") or ""),
            "label": str(node.get("label") or ""),
            "mastery": mastery,
        })
    return {
        "nodeCount": len(nodes),
        "documentCount": len(documents),
        "mastery": metrics.get("mastery") or metrics.get("masteryPercent") or metrics.get("mastery_percent"),
        "subjects": [
            {"id": str(node.get("id") or ""), "label": str(node.get("label") or "")}
            for node in nodes
            if isinstance(node, dict) and str(node.get("id") or "").startswith("subject:")
        ][:8],
        "weakNodes": weak_nodes[:8],
    }


def safe_workspace_dialogue_summary(student_id: str) -> dict[str, Any]:
    try:
        return workspace_dialogue_summary(build_workspace(student_id, include_library=True, include_memory=True))
    except Exception as exc:
        return {
            "workspaceUnavailable": True,
            "errorType": exc.__class__.__name__,
            "errorMessage": str(exc),
        }


def active_practice_context(context: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(context, dict):
        return None
    session = context.get("activePracticeSession")
    return session if isinstance(session, dict) else None


def dialogue_context_intent(context: dict[str, Any] | None, prompt: str) -> str:
    intent = normalize_companion_intent((context or {}).get("companionIntent") if isinstance(context, dict) else "")
    if intent:
        return intent
    return "probe_weakness" if looks_like_weakness_probe_request(prompt) else "query"


def conversation_instruction(prompt: str, context: dict[str, Any] | None = None) -> str:
    practice_session = active_practice_context(context)
    intent = normalize_companion_intent((context or {}).get("companionIntent") if isinstance(context, dict) else "")
    if intent == "practice_review" and not practice_session:
        return (
            "当前请求是左侧练习讲评，但缺少 activePracticeSession。"
            "请直接说明：无法讲评，因为前端没有传入当前练习会话；不要生成新题，不要询问学习计划，不要读写 workspace。\n\n"
            f"学生请求：{prompt}"
        )
    if practice_session:
        return (
            "你是学生的 AI 学伴。当前请求绑定了左侧正在进行或刚完成的练习会话。\n"
            "要求：必须只围绕 activePracticeSession 中的 sessionId、题目、学生答案、批改结果和反馈回应；"
            "不要重新生成另一套题；不要询问学习时间、学习方向或今日安排；不要调用或提及 learning-companion skill；不要读写 workspace。"
            "如果题目已批改，逐题解释错因、正确思路和下一步复习建议；如果题目未批改，只给针对当前题目的提示，不直接泄露答案。\n\n"
            f"学生请求：{prompt}"
        )
    if looks_like_weakness_probe_request(prompt):
        return (
            "你是学生的 AI 学伴。当前请求是普通对话中的薄弱点追问，不是资料整理、知识图谱构建、Wiki 写入或练习会话生成。\n"
            "要求：只问 1 个诊断问题；不要直接讲答案；不要列多个问题；不要调用或提及 learning-companion skill；不要读写 workspace；"
            "可以引用随消息提供的 workspace 摘要判断当前薄弱点；如果摘要不足，要说明缺少哪类学习证据。"
            "等学生回答后再判断错因，并建议是否生成练习。\n\n"
            f"学生请求：{prompt}"
        )
    return (
        "你是学生的 AI 学伴。当前请求是普通对话，不是持久化学习任务。\n"
        "要求：直接用对话方式回应；不要调用或提及 learning-companion skill；不要读写 workspace；不要构建知识图谱或 Wiki。"
        "可以依据随消息提供的 workspace 摘要回答当前知识图谱、Wiki、薄弱点和学习状态。\n\n"
        f"学生请求：{prompt}"
    )


def persistent_learning_instruction(prompt: str, context: dict[str, Any], student_id: str) -> str:
    intent = str(context.get("intent") or context.get("companionIntent") or "ingest_knowledge").strip()
    return (
        "你正在执行 AI 学伴的持久化学习任务。必须加载并遵守 learning-companion skill；"
        "涉及知识图谱时还必须加载并遵守 knowledge-graph skill。\n"
        "The current working directory is already the workspace root. "
        "For every Read/Write/Edit/List tool call, file_path/path 必须使用相对路径；"
        "不要在 file_path/path 中写 workspaceRoot，也不要使用任何以 `/` 开头的绝对路径。"
        "正确示例：`wiki/pages/graph/course_graph.md`。\n"
        "Do not use WikiIngest for learning-companion persistent state. "
        "Do not create only a generic Wiki overview page.\n"
        "必须直接用 workspace 文件工具写入结构化学习伴侣文件：\n"
        "- wiki/pages/graph/course_graph.md\n"
        "- wiki/pages/graph/student_overlay.md\n"
        "- wiki/pages/evaluation/metrics.md\n"
        "- wiki/pages/memory/tree.md\n"
        "- wiki/pages/memory/profile.md\n"
        "- wiki/pages/memory/reflections.md\n"
        "知识材料的笔记只能作为证据写入 wiki/pages/notes/，不能代替 graph/overlay/metrics。\n"
        "单次学生输入最多提取 5 个 L3 知识点；只允许 1 个 L1 subject 和 1 个 L2 unit，除非学生明确输入多个领域或多个章节。\n"
        "普通知识录入不要创建 assessment_point；只有用户明确要求测评点、练习设计或验收指标时才允许创建 assessment_point。\n"
        "每个结构化 JSON 页面控制在 6000 字节以内；每个结构化 Markdown 文件硬性控制在 4800 字节以内（包含 frontmatter 和 JSON fence），目标控制在 4500 字节以内；工具单次 Write 上限是 5000 bytes。\n"
        "graph/overlay/metrics/memory 只保存索引、状态和证据路径，正文细节放入 notes；L3 summary 不超过 40 个汉字，edge label 不超过 12 个汉字。\n"
        "不要用 Append 分块写 graph/overlay/metrics/memory；如果结构化页超过限制，必须减少 L3 数量、边、summary 和说明字段，再一次性 Write 并 Read back。\n"
        "如果 intent 是 learn：这是学伴版 /learn，不是普通知识录入。除 notes、course_graph、student_overlay、metrics、memory 外，"
        "还必须写入 wiki/pages/learning-skills/<skill-id>.md，topic 使用 learning-skill 或 skill-candidate。"
        "该学习技能页必须包含一个 JSON fenced block，字段至少包含 skillId、source、focus、linkedNodeIds、procedure、verification、status；"
        "procedure 写学生或学伴下次如何复用这套资料完成同类学习任务；verification 写验证计划、通过标准、失败处理和下一次复用入口；"
        "status 初始只能是 draft 或 pending_verification，未通过验证不要写 active。"
        "metrics.md 顶层 evidence 必须追加 kind=skill_candidate 的证据，linkedNodeIds 必须指向真实 L3 节点。"
        "未通过验证前不要提升 mastery；只允许保守 mastery、confidence、reviewPriority 或 pending_verification 状态。\n"
        "Evidence-first write order: write or update every referenced `wiki/pages/notes/` evidence page before writing graph/overlay/metrics；"
        "Every L3 node must have at least one existing note whose `linkedNodeIds` contains that exact L3 id；"
        "read back every referenced note path before reporting success。\n"
        "ID registry rule: before writing any file, decide one L3 id registry from the material; "
        "then copy those exact ids into notes linkedNodeIds, course_graph.md nodes/evidence, student_overlay.md nodes, "
        "metrics.md evidence, and memory pages. Never rename, translate, shorten, or regenerate L3 ids between files。\n"
        "严格图谱契约：Only L1/L2/L3 nodes belong in `course_graph.md`；"
        "L1/L2/L3 都必须写入同一个 nodes 数组；不要把 L1 写成 `graph.subject`，不要把 L2 写成 `graph.units`。\n"
        "id 命名规则：L1 id 必须以 `subject:` 开头；L2 id 必须以 `unit:` 开头；L3 id 必须以 kp: 开头，"
        "不要输出 `concept:kp-*`、`procedure:kp-*`、`application:kp-*`、`misconception:kp-*` 或 `assessment_point:kp-*`。\n"
        "L1 type 必须是 `subject`；L2 type 必须是 `unit`，Do not use `topic` as a node type；"
        "L3 type 必须是 `concept`、`procedure`、`application`、`misconception` 或 `assessment_point`；"
        "Do not use `knowledge_point` as a node type；it is only a layer description, not a JSON `type` value。"
        "Allowed edge types in course_graph.md: `contains`, `prerequisite`, `explains`, `applies_to`, `contrasts_with`, `misconception_of`, `assessed_by`, `remediates`；"
        "Do not invent edge types；Never output `supports`、`orders`、`related`、`transfer`、`review`、`misconception` as course_graph edge types；map them to the allowed edge types or drop the edge。\n"
        "Do not create `evidence` nodes inside `course_graph.md`。\n"
        "Every note must expose `linkedNodeIds` and point to real L3 ids；"
        "student_overlay.md must use L3 ids in its `nodes` map；"
        "metrics.md must include `evidence`; it must be a top-level `evidence` array linked to real L3 ids；"
        "student_overlay.md and metrics.md may only reference L3 ids that already exist in course_graph.md nodes；"
        "metrics.md 顶层 evidence 每项必须包含 linkedNodeIds 数组；不要只写 nodeId，单节点证据也要写成 `linkedNodeIds: [\"kp:...\"]`；"
        "do not put the only evaluation evidence under `metrics[*].evidence`。\n"
        "写完后必须 list/read back 六个必需文件并确认 JSON 可解析；缺任一文件都必须继续修正，不要提前结束。\n"
        "如果无法从材料构建真实 L1/L2/L3 图谱，必须报告失败，不要写占位图谱、演示图谱或普通 WikiIngest 页面。\n\n"
        f"studentId: {student_id}\n"
        f"intent: {intent or 'ingest_knowledge'}\n\n"
        f"学生输入：{prompt}"
    )


def practice_session_instruction(
    student_id: str,
    session_id: str,
    target_node_ids: list[str],
    limit: Any,
    question_types: Any,
    keyword: Any,
    difficulty: Any,
    practice_context: dict[str, Any] | None = None,
) -> str:
    safe_limit = max(1, min(10, int(limit or 3)))
    safe_session_id = str(session_id or "").strip()
    types = question_types if isinstance(question_types, list) else []
    safe_keyword = str(keyword or "").strip()
    safe_difficulty = str(difficulty or "").strip()
    target_nodes = (practice_context or {}).get("targetNodes") if isinstance((practice_context or {}).get("targetNodes"), list) else []
    evidence = (practice_context or {}).get("evidence") if isinstance((practice_context or {}).get("evidence"), list) else []
    schema_example = {
        "sessionId": safe_session_id,
        "source": "doagent",
        "targetNodes": [{"id": "kp:example", "label": "示例知识点"}],
        "questions": [
            {
                "questionId": "q1",
                "type": "single_choice",
                "stem": "题干",
                "nodeIds": ["kp:example"],
                "options": [{"key": "A", "text": "选项 A"}, {"key": "B", "text": "选项 B"}],
                "expectedAnswer": "A",
                "rubric": "选择 A 得分；选择其他选项不得分。",
            },
            {
                "questionId": "q2",
                "type": "true_false",
                "stem": "判断题题干",
                "nodeIds": ["kp:example"],
                "options": [{"key": "true", "text": "正确"}, {"key": "false", "text": "错误"}],
                "expectedAnswer": "false",
                "rubric": "回答 false 得分。",
            },
            {
                "questionId": "q3",
                "type": "short_answer",
                "stem": "简答题题干",
                "nodeIds": ["kp:example"],
                "expectedAnswer": "参考答案必须写成字符串。",
                "rubric": "评分标准必须写成字符串。",
            },
        ],
    }
    return (
        "你正在执行 AI 学伴的练习生成任务。必须加载 learning-companion skill，但本任务只生成一份练习会话，"
        "不要重建知识图谱，不要改写学生状态、评估指标或长期记忆。\n"
        "当前工作目录已经是 workspace root；所有工具路径必须使用相对路径，禁止使用任何以 / 开头的绝对路径，"
        "禁止把 workspaceRoot、/root、/tmp、/private、/home 写入任何工具参数。\n"
        "worker 已经读取并提供目标 L3 知识点和证据摘要；你必须只依据下方 `目标 L3 知识点` 与 `证据摘要` 出题。\n"
        "本任务禁止调用 List/list_files、Bash、ExecuteCode、Python、Append、Edit；如需核对，只允许 Read wiki/pages/graph/course_graph.md 和 Read 新写入的 practice-session 文件。\n"
        f"只写入一个文件：wiki/pages/practice-sessions/{safe_session_id}.md。\n"
        f"sessionId 必须精确写为 {safe_session_id}，不要新造、不要省略、不要覆盖其它 session。\n"
        "该文件必须是可解析 JSON fenced block，顶层对象必须采用固定练习 schema。\n"
        "固定 schema：字段至少包含 sessionId、source、targetNodes、questions。\n"
        "targetNodes 必须是对象数组，每项必须是 {\"id\":\"kp:...\",\"label\":\"中文知识点名\"}，不能写成字符串数组。\n"
        "questions 每项必须包含：questionId、type、stem、nodeIds、expectedAnswer、rubric；"
        "expectedAnswer 和 rubric 必须是字符串，不能写成布尔值、数组或对象。\n"
        "选择题必须包含 options 数组，options 每项必须是 {\"key\":\"A\",\"text\":\"...\"}，不能使用 id 字段；"
        "选择题 expectedAnswer 必须只写选项 key；单选只能写一个 key，例如 \"A\"；多选用英文逗号连接 key，例如 \"A,C\"；禁止写选项正文、解释或完整句子。\n"
        "判断题 type 必须是 true_false，options 必须精确包含 {\"key\":\"true\",\"text\":\"正确\"} 和 {\"key\":\"false\",\"text\":\"错误\"}，expectedAnswer 只能是字符串 \"true\" 或 \"false\"；"
        "简答题必须使用 type=short_answer，不要生成 options。\n"
        "禁止出现未转义英文双引号；JSON 字符串里的引用请使用中文引号“”或把英文双引号写成 \\\"，尤其是 stem、options[].text、expectedAnswer、rubric。\n"
        "禁止输出 targetNodeIds、studentId、id、answer、sampleAnswer、correctAnswer、linkedNodeIds、options[].id。\n"
        "必须严格照下面 JSON 形状写：\n"
        f"{json.dumps(schema_example, ensure_ascii=False, indent=2)}\n"
        "题目必须只依据目标知识点和证据页生成，不得引入无关课程内容。\n"
        "写完后只需 Read 新写入的 practice-session 文件并确认 JSON 可解析；如果 JSON 解析失败，必须修正该 practice-session 文件后再结束。\n\n"
        f"studentId: {student_id}\n"
        f"intent: practice_session\n"
        f"sessionId: {safe_session_id}\n"
        f"目标节点: {json.dumps(target_node_ids, ensure_ascii=False)}\n"
        f"目标 L3 知识点: {json.dumps(target_nodes, ensure_ascii=False)}\n"
        f"证据摘要: {json.dumps(evidence, ensure_ascii=False)}\n"
        f"题量: {safe_limit}\n"
        f"题型: {json.dumps(types, ensure_ascii=False)}\n"
        f"关键词约束: {safe_keyword or '无'}\n"
        f"难度约束: {safe_difficulty or '无'}"
    )


def practice_session_id(student_id: str, target_node_ids: list[str] | None = None) -> str:
    base = re.sub(r"[^A-Za-z0-9_.-]+", "-", str(student_id or "student")).strip("-") or "student"
    seed = "|".join(str(item) for item in (target_node_ids or []) if str(item or "").strip())
    suffix = hashlib.sha1(f"{base}:{seed}:{time.time_ns()}".encode("utf-8")).hexdigest()[:10]
    return f"practice-session-{base}-{suffix}"


def practice_attempt_id(session_id: str) -> str:
    safe_session_id = str(session_id or "").strip()
    return f"{safe_session_id}-{int(time.time() * 1000)}"


def build_practice_generation_context(snapshot: dict[str, Any], target_node_ids: list[str], limit: int) -> dict[str, Any]:
    graph_nodes = (snapshot.get("graph") or {}).get("nodes") if isinstance(snapshot.get("graph"), dict) else []
    graph_edges = (snapshot.get("graph") or {}).get("edges") if isinstance(snapshot.get("graph"), dict) else []
    requested_ids = {str(node_id).strip() for node_id in target_node_ids if str(node_id or "").strip()}
    l3_types = {"concept", "procedure", "application", "misconception", "assessment_point"}
    node_by_id: dict[str, dict[str, Any]] = {}
    for node in graph_nodes if isinstance(graph_nodes, list) else []:
        if not isinstance(node, dict):
            continue
        node_id = str(node.get("id") or "").strip()
        if node_id:
            node_by_id[node_id] = node
    selected_units = {
        node_id for node_id in requested_ids
        if str((node_by_id.get(node_id) or {}).get("type") or "").strip() == "unit" or node_id.startswith("unit:")
    }
    selected_subjects = {
        node_id for node_id in requested_ids
        if str((node_by_id.get(node_id) or {}).get("type") or "").strip() == "subject" or node_id.startswith("subject:")
    }
    parent_by_child: dict[str, list[str]] = {}
    for edge in graph_edges if isinstance(graph_edges, list) else []:
        if not isinstance(edge, dict) or str(edge.get("type") or "") != "contains":
            continue
        source = str(edge.get("source") or "").strip()
        target = str(edge.get("target") or "").strip()
        if source and target:
            parent_by_child.setdefault(target, []).append(source)

    def is_l3_node(node: dict[str, Any], node_id: str) -> bool:
        return node_id.startswith("kp:") or str(node.get("type") or "").strip() in l3_types

    def selected_container_matches(node: dict[str, Any], node_id: str) -> bool:
        if node_id in requested_ids:
            return True
        parent_ids = set(parent_by_child.get(node_id, []))
        unit_id = str(node.get("unitId") or node.get("parentId") or "").strip()
        subject_id = str(node.get("subjectId") or "").strip()
        if unit_id:
            parent_ids.add(unit_id)
        if subject_id:
            parent_ids.add(subject_id)
        if selected_units and parent_ids & selected_units:
            return True
        if selected_subjects and parent_ids & selected_subjects:
            return True
        for unit in list(parent_ids):
            if set(parent_by_child.get(unit, [])) & selected_subjects:
                return True
        return False

    target_nodes: list[dict[str, str]] = []
    for node in graph_nodes if isinstance(graph_nodes, list) else []:
        if not isinstance(node, dict):
            continue
        node_id = str(node.get("id") or "").strip()
        node_type = str(node.get("type") or "").strip()
        if not node_id or not is_l3_node(node, node_id):
            continue
        if requested_ids and not selected_container_matches(node, node_id):
            continue
        label = str(node.get("label") or node.get("name") or node_id).strip()
        target_nodes.append({
            "id": node_id,
            "label": label,
            "type": node_type or "concept",
            "summary": str(node.get("summary") or "").strip()[:160],
        })
        if len(target_nodes) >= max(1, min(10, limit or 3)):
            break
    if not target_nodes:
        for node in graph_nodes if isinstance(graph_nodes, list) else []:
            if not isinstance(node, dict):
                continue
            node_id = str(node.get("id") or "").strip()
            if not node_id.startswith("kp:"):
                continue
            target_nodes.append({
                "id": node_id,
                "label": str(node.get("label") or node.get("name") or node_id).strip(),
                "type": str(node.get("type") or "concept"),
                "summary": str(node.get("summary") or "").strip()[:160],
            })
            if len(target_nodes) >= max(1, min(10, limit or 3)):
                break
    target_id_set = {node["id"] for node in target_nodes}
    evidence: list[dict[str, str]] = []
    for document in snapshot.get("documents", []):
        if not isinstance(document, dict):
            continue
        links = {str(node_id) for node_id in (document.get("linkedNodeIds") if isinstance(document.get("linkedNodeIds"), list) else [])}
        if not (links & target_id_set):
            continue
        evidence.append({
            "title": str(document.get("title") or document.get("path") or "证据页").strip()[:80],
            "path": str(document.get("path") or "").strip(),
            "summary": str(document.get("summary") or "").strip()[:240],
        })
        if len(evidence) >= 8:
            break
    return {"targetNodes": target_nodes, "evidence": evidence}


def normalize_page_path(path: str) -> list[str]:
    normalized = str(path or "").strip().lstrip("/")
    if not normalized:
        return []
    candidates = [normalized]
    if normalized.startswith("wiki/"):
        candidates.append(normalized.removeprefix("wiki/"))
    else:
        candidates.append(f"wiki/{normalized}")
    return list(dict.fromkeys(candidates))


def canonical_wiki_page_path(path: str) -> str:
    normalized = str(path or "").strip().lstrip("/")
    if normalized.startswith("wiki/"):
        return normalized
    if normalized.startswith("pages/"):
        return f"wiki/{normalized}"
    return normalized


def is_system_page_path(path: str) -> bool:
    return canonical_wiki_page_path(path) in SYSTEM_PAGES


def get_page(path: str) -> dict[str, Any]:
    last_error: Exception | None = None
    for candidate in normalize_page_path(path):
        try:
            result = rpc("wiki/getPage", workspace_params() | {"path": candidate}, timeout=30.0)
            page = result.get("page") if isinstance(result.get("page"), dict) else result
            if isinstance(page, dict):
                page["path"] = canonical_wiki_page_path(str(page.get("path") or candidate))
                return page
        except Exception as exc:
            last_error = exc
    raise RuntimeError(str(last_error or "wiki page not found"))


def missing_wiki_page(exc: BaseException) -> bool:
    text = str(exc).lower()
    return "wiki page not found" in text or "page not found" in text or "not found" in text


def optional_page_payload(path: str) -> dict[str, Any] | None:
    try:
        page = get_page(path)
    except Exception as exc:
        if missing_wiki_page(exc):
            return None
        raise
    payload = page_payload(page)
    if not isinstance(payload, dict):
        raise InvalidWikiJsonPayload(path)
    return payload


def first_page_list(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if not isinstance(value, dict):
        return []
    for key in ("pages", "items", "records", "results", "data", "list", "files", "entries"):
        nested = value.get(key)
        if isinstance(nested, list):
            return [item for item in nested if isinstance(item, dict)]
        rows = first_page_list(nested)
        if rows:
            return rows
    return []


def decode_json_object(text: Any) -> Any:
    if not isinstance(text, str) or not text.strip():
        return None
    candidate = text.strip()
    for block in re.findall(r"```(?:json)?\s*(.*?)```", candidate, flags=re.I | re.S):
        try:
            return json.loads(block.strip(), strict=False)
        except json.JSONDecodeError:
            pass
    try:
        return json.loads(candidate, strict=False)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", candidate, re.S)
    if not match:
        return None
    try:
        return json.loads(match.group(0), strict=False)
    except json.JSONDecodeError:
        return None


def json_payload_error(text: Any) -> str | None:
    if not isinstance(text, str) or not text.strip():
        return "JSON payload is empty"
    candidate = text.strip()
    errors: list[str] = []
    for block in re.findall(r"```(?:json)?\s*(.*?)```", candidate, flags=re.I | re.S):
        try:
            json.loads(block.strip(), strict=False)
            return None
        except json.JSONDecodeError as exc:
            errors.append(f"invalid fenced JSON: {exc.msg} at line {exc.lineno} column {exc.colno}")
    try:
        json.loads(candidate, strict=False)
        return None
    except json.JSONDecodeError as exc:
        errors.append(f"invalid raw JSON: {exc.msg} at line {exc.lineno} column {exc.colno}")
    match = re.search(r"\{.*\}", candidate, re.S)
    if match:
        try:
            json.loads(match.group(0), strict=False)
            return None
        except json.JSONDecodeError as exc:
            errors.append(f"invalid embedded JSON: {exc.msg} at line {exc.lineno} column {exc.colno}")
    return errors[0] if errors else "JSON object not found"


def _decode_frontmatter_scalar(value: str) -> Any:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if (raw.startswith('"') and raw.endswith('"')) or (raw.startswith("'") and raw.endswith("'")):
        return raw[1:-1]
    if raw in {"[]", "{}"} or (raw.startswith("[") and raw.endswith("]")):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return raw
    return raw


def markdown_frontmatter(content: Any) -> dict[str, Any]:
    if not isinstance(content, str) or not content.startswith("---"):
        return {}
    lines = content.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}
    end_index = next((index for index, line in enumerate(lines[1:], start=1) if line.strip() == "---"), -1)
    if end_index <= 0:
        return {}
    result: dict[str, Any] = {}
    current_key = ""
    for line in lines[1:end_index]:
        if not line.strip():
            continue
        if line[:1].isspace() and current_key and line.strip().startswith("- "):
            result.setdefault(current_key, [])
            if isinstance(result[current_key], list):
                result[current_key].append(_decode_frontmatter_scalar(line.strip()[2:]))
            continue
        if ":" not in line:
            current_key = ""
            continue
        key, value = line.split(":", 1)
        current_key = key.strip()
        if not current_key:
            continue
        result[current_key] = _decode_frontmatter_scalar(value) if value.strip() else []
    return result


def page_payload(page: dict[str, Any]) -> dict[str, Any] | None:
    content = page.get("content")
    payload = decode_json_object(content)
    return payload if isinstance(payload, dict) else None


def fenced_json_page(payload: dict[str, Any]) -> str:
    return "```json\n" + json.dumps(payload, ensure_ascii=False, indent=2) + "\n```"


def save_json_page(path: str, title: str, payload: dict[str, Any], topic: str = "", summary: str = "") -> None:
    rpc(
        "wiki/savePage",
        workspace_params() | {
            "page": {
                "path": path,
                "title": title,
                "topic": topic,
                "summary": summary,
                "content": fenced_json_page(payload),
            }
        },
        timeout=30.0,
    )


def default_memory_page_payload(key: str, student_id: str, repair_reason: str) -> dict[str, Any]:
    base = {
        "studentId": student_id,
        "version": "learning-companion-memory-v1",
        "updatedAt": now_iso(),
        "repair": {
            "reason": repair_reason,
            "by": "learning-companion-worker",
            "at": now_iso(),
        },
    }
    if key == "memoryTree":
        return base | {"items": []}
    if key == "memoryProfile":
        return base | {"practiceHistory": [], "learningPreferences": {}}
    if key == "memoryReflections":
        return base | {"reflections": []}
    raise RuntimeError(f"unknown memory page key: {key}")


def repair_memory_page(key: str, student_id: str, reason: str) -> dict[str, Any]:
    path = MEMORY_PAGE_KEYS.get(key)
    spec = MEMORY_PAGE_SPECS.get(key) or {}
    if not path:
        raise RuntimeError(f"unknown memory page key: {key}")
    payload = default_memory_page_payload(key, student_id, reason)
    save_json_page(
        path,
        str(spec.get("title") or key),
        payload,
        topic="memory",
        summary=str(spec.get("summary") or "学伴系统记忆页。"),
    )
    return payload


def normalize_graph_node(node: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(node)
    if not normalized.get("label") and normalized.get("name"):
        normalized["label"] = normalized.get("name")
    return normalized


def normalize_graph_edge(edge: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(edge)
    if not normalized.get("source") and normalized.get("from"):
        normalized["source"] = normalized.get("from")
    if not normalized.get("target") and normalized.get("to"):
        normalized["target"] = normalized.get("to")
    if not normalized.get("label") and normalized.get("type"):
        normalized["label"] = str(normalized.get("type") or "")
    return normalized


def default_graph(student_id: str, status: dict[str, Any]) -> dict[str, Any]:
    return {
        "course_id": f"learning-companion:{student_id}",
        "title": "学伴全局知识图谱",
        "version": "workspace-v1",
        "nodes": [],
        "edges": [],
        "meta": {
            "owner": student_id,
            "scope": "global",
            "workspaceRoot": workspace_root(),
            "wikiStatus": status,
            "updatedAt": now_iso(),
        },
    }


def load_graph(student_id: str, status: dict[str, Any]) -> dict[str, Any]:
    graph = default_graph(student_id, status)
    payload = optional_page_payload(PATHS["courseGraph"])
    if payload is None:
        return graph
    for key in ("course_id", "title", "version", "nodes", "edges"):
        if key in payload:
            graph[key] = payload[key]
    if isinstance(payload.get("meta"), dict):
        graph["meta"] = dict(graph.get("meta") or {}) | payload["meta"]
    graph["nodes"] = [normalize_graph_node(item) for item in graph.get("nodes", []) if isinstance(item, dict)]
    graph["edges"] = [normalize_graph_edge(item) for item in graph.get("edges", []) if isinstance(item, dict)]
    return graph


def load_node_states() -> dict[str, dict[str, Any]]:
    payload = optional_page_payload(PATHS["studentOverlay"])
    if payload is None:
        return {}
    nodes = payload.get("nodes")
    if not nodes and isinstance(payload.get("overlay"), dict):
        nodes = payload["overlay"].get("nodes")
    if isinstance(nodes, dict):
        return {str(key): value for key, value in nodes.items() if isinstance(value, dict)}
    if isinstance(nodes, list):
        return {str(item.get("id")): item for item in nodes if isinstance(item, dict) and item.get("id")}
    return {}


def load_memory_pages(student_id: str) -> dict[str, Any]:
    memory: dict[str, Any] = {}
    for key, path in MEMORY_PAGE_KEYS.items():
        try:
            payload = optional_page_payload(path)
        except InvalidWikiJsonPayload:
            payload = repair_memory_page(key, student_id, "invalid_json_payload")
        if payload is None:
            payload = repair_memory_page(key, student_id, "missing_page")
        memory[key] = payload
    return memory


def linked_ids_by_document_path(documents: list[dict[str, Any]]) -> dict[str, set[str]]:
    linked_ids_by_path: dict[str, set[str]] = {}
    for doc in documents:
        if not isinstance(doc, dict):
            continue
        path = canonical_wiki_page_path(str(doc.get("path") or doc.get("id") or ""))
        if not path:
            continue
        linked_ids_by_path[path] = {
            str(node_id)
            for node_id in (doc.get("linkedNodeIds") if isinstance(doc.get("linkedNodeIds"), list) else [])
        }
    return linked_ids_by_path


def load_repair_documents() -> list[dict[str, Any]]:
    wiki_pages = rpc("wiki/listPages", workspace_params() | {"limit": 500}, timeout=20.0)
    return load_documents(wiki_pages, include_library=True)


def _label_from_node_id(node_id: str) -> str:
    label = re.sub(r"^kp:", "", str(node_id or "").strip())
    label = re.sub(r"[-_]+", " ", label).strip()
    return label or node_id


def _document_title(document: dict[str, Any]) -> str:
    title = str(document.get("title") or "").strip()
    if title:
        return title
    content = str(document.get("content") or "")
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("#"):
            return line.lstrip("#").strip()
    return ""


def _document_summary_text(document: dict[str, Any]) -> str:
    parts = [_document_title(document)]
    content = str(document.get("content") or "")
    for line in content.splitlines():
        text = line.strip().strip("> ")
        if not text or text.startswith("---") or text.startswith("```") or text.startswith("{") or text.startswith("}"):
            continue
        if text.startswith("#"):
            text = text.lstrip("#").strip()
        if text:
            parts.append(text)
        if len(" ".join(parts)) >= 240:
            break
    return " ".join(part for part in parts if part).strip()


def _recover_course_topic(documents: list[dict[str, Any]]) -> str:
    candidates: list[str] = []
    for document in documents:
        if not isinstance(document, dict):
            continue
        title = _document_title(document)
        if title:
            candidates.append(title)
        summary = _document_summary_text(document)
        if summary:
            candidates.append(summary)
        session = document.get("practiceSession") if isinstance(document.get("practiceSession"), dict) else None
        if session:
            for target in session.get("targetNodes") if isinstance(session.get("targetNodes"), list) else []:
                if isinstance(target, dict) and str(target.get("label") or "").strip():
                    candidates.append(str(target.get("label")).strip())
            for question in session.get("questions") if isinstance(session.get("questions"), list) else []:
                if isinstance(question, dict) and str(question.get("stem") or "").strip():
                    candidates.append(str(question.get("stem")).strip())
    joined = "\n".join(candidates)
    if "卫星通信" in joined:
        return "卫星通信概论"
    for pattern in (r"([^，。；;:：\n]{2,24}概论)", r"([^，。；;:：\n]{2,24}通信)", r"([^，。；;:：\n]{2,24}课程)"):
        match = re.search(pattern, joined)
        if match:
            return match.group(1).strip()
    return "已恢复学伴知识"


def recover_graph_from_documents(student_id: str, documents: list[dict[str, Any]], reason: str) -> dict[str, Any]:
    l3_nodes: dict[str, dict[str, Any]] = {}

    def add_node(node_id: Any, label: Any = "", evidence_path: str = "") -> None:
        normalized_id = str(node_id or "").strip()
        if not normalized_id.startswith("kp:"):
            return
        node = l3_nodes.setdefault(normalized_id, {
            "id": normalized_id,
            "label": _label_from_node_id(normalized_id),
            "type": "concept",
            "subjectId": "subject:recovered-learning-companion",
            "unitId": "unit:recovered-learning-companion:evidence",
            "summary": "从已持久化学习证据恢复的知识点。",
            "evidence": [],
        })
        clean_label = str(label or "").strip()
        if clean_label:
            node["label"] = clean_label[:80]
        if evidence_path:
            evidence = node.setdefault("evidence", [])
            if evidence_path not in evidence:
                evidence.append(evidence_path)

    for document in documents:
        if not isinstance(document, dict):
            continue
        path = canonical_wiki_page_path(str(document.get("path") or ""))
        evidence_summary = _document_summary_text(document)
        for node_id in document.get("linkedNodeIds") if isinstance(document.get("linkedNodeIds"), list) else []:
            add_node(node_id, "", path)
        session = document.get("practiceSession") if isinstance(document.get("practiceSession"), dict) else None
        if session:
            for target in session.get("targetNodes") if isinstance(session.get("targetNodes"), list) else []:
                if isinstance(target, dict):
                    add_node(target.get("id"), target.get("label"), path)
            for question in session.get("questions") if isinstance(session.get("questions"), list) else []:
                if not isinstance(question, dict):
                    continue
                for node_id in question.get("nodeIds") if isinstance(question.get("nodeIds"), list) else []:
                    add_node(node_id, "", path)
                    if str(node_id or "").strip() in l3_nodes and str(question.get("stem") or "").strip():
                        l3_nodes[str(node_id).strip()]["summary"] = str(question.get("stem")).strip()[:160]
        if evidence_summary:
            for node_id in document.get("linkedNodeIds") if isinstance(document.get("linkedNodeIds"), list) else []:
                normalized_id = str(node_id or "").strip()
                if normalized_id in l3_nodes:
                    l3_nodes[normalized_id]["summary"] = evidence_summary[:160]

    course_topic = _recover_course_topic(documents)
    subject = {
        "id": "subject:recovered-learning-companion",
        "label": course_topic,
        "type": "subject",
        "summary": f"从现有 notes、练习会话和学生证据恢复的{course_topic}知识图谱。",
    }
    unit = {
        "id": "unit:recovered-learning-companion:evidence",
        "label": f"{course_topic}学习证据",
        "type": "unit",
        "subjectId": subject["id"],
        "summary": "由 workspace 中已有证据页支撑的知识点集合。",
    }
    nodes = [subject, unit, *l3_nodes.values()]
    edges = [
        {"source": subject["id"], "target": unit["id"], "type": "contains", "label": "包含"},
        *[
            {"source": unit["id"], "target": node_id, "type": "contains", "label": "包含"}
            for node_id in l3_nodes
        ],
    ]
    graph = {
        "course_id": os.environ.get("LEARNING_COMPANION_COURSE_ID") or f"learning-companion:{student_id}",
        "title": f"{course_topic}知识图谱（已修复）",
        "version": "workspace-repair-v1",
        "nodes": nodes,
        "edges": edges,
        "meta": {
            "owner": student_id,
            "scope": "course" if os.environ.get("LEARNING_COMPANION_COURSE_ID") else "global",
            "workspaceRoot": workspace_root(),
            "contractRepair": {
                "by": "learning-companion-worker",
                "at": now_iso(),
                "reason": reason,
                "sourceDocumentCount": len(documents),
                "recoveredL3NodeCount": len(l3_nodes),
            },
            "updatedAt": now_iso(),
        },
    }
    save_json_page(
        PATHS["courseGraph"],
        f"{course_topic}知识图谱（已修复）",
        graph,
        topic="graph",
        summary=f"从已有学习证据恢复的{course_topic}合法课程知识图谱。",
    )
    return graph


def repair_course_graph_contract(student_id: str, documents: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    repair_documents = documents if documents is not None else load_repair_documents()
    try:
        payload = optional_page_payload(PATHS["courseGraph"])
    except InvalidWikiJsonPayload:
        graph = recover_graph_from_documents(student_id, repair_documents, "invalid_course_graph_json")
        return {
            "repaired": True,
            "reason": "invalid_course_graph_json",
            "removedUnsupportedEdges": 0,
            "removedEvidenceLessNodes": 0,
            "remainingEdges": len(graph.get("edges") or []),
            "recoveredNodeCount": len(graph.get("nodes") or []),
        }
    if payload is None:
        return {"repaired": False, "reason": "course_graph_missing", "removedUnsupportedEdges": 0, "removedEvidenceLessNodes": 0}
    if not isinstance(payload.get("edges"), list):
        return {"repaired": False, "reason": "course_graph_edges_missing", "removedUnsupportedEdges": 0, "removedEvidenceLessNodes": 0}

    nodes = [normalize_graph_node(item) for item in payload.get("nodes", []) if isinstance(item, dict)]
    recovered_topic = _recover_course_topic(repair_documents)
    contract_repair = (payload.get("meta") if isinstance(payload.get("meta"), dict) else {}).get("contractRepair")
    repair_reason = contract_repair.get("reason") if isinstance(contract_repair, dict) else ""
    title = str(payload.get("title") or "")
    subject_labels = {
        str(node.get("label") or "")
        for node in nodes
        if str(node.get("id") or "") == "subject:recovered-learning-companion"
    }
    if (
        repair_reason == "invalid_course_graph_json"
        and recovered_topic != "已恢复学伴知识"
        and recovered_topic not in title
        and all(recovered_topic not in label for label in subject_labels)
    ):
        graph = recover_graph_from_documents(student_id, repair_documents, "recovered_graph_topic_repair")
        return {
            "repaired": True,
            "reason": "recovered_graph_topic_repair",
            "removedUnsupportedEdges": 0,
            "removedEvidenceLessNodes": 0,
            "remainingEdges": len(graph.get("edges") or []),
            "recoveredNodeCount": len(graph.get("nodes") or []),
        }

    linked_ids_by_path = linked_ids_by_document_path(repair_documents)
    kept_nodes: list[dict[str, Any]] = []
    removed_nodes: list[dict[str, Any]] = []
    for node in nodes:
        node_id = str(node.get("id") or "").strip()
        node_type = str(node.get("type") or "").lower()
        if node_type in L3_NODE_TYPES:
            evidence_paths = [
                canonical_wiki_page_path(str(path or ""))
                for path in (node.get("evidence") if isinstance(node.get("evidence"), list) else [])
                if str(path or "").strip()
            ]
            if evidence_paths and not any(node_id in linked_ids_by_path.get(path, set()) for path in evidence_paths):
                removed_nodes.append({"id": node_id, "label": node.get("label"), "reason": "missing_matching_wiki_note_evidence"})
                continue
        kept_nodes.append(node)
    kept_node_ids = {str(node.get("id") or "") for node in kept_nodes if str(node.get("id") or "").strip()}
    kept_edges: list[dict[str, Any]] = []
    removed_edges: list[dict[str, Any]] = []
    for item in payload.get("edges", []):
        if not isinstance(item, dict):
            removed_edges.append({"reason": "non_object_edge"})
            continue
        edge = normalize_graph_edge(item)
        edge_type = str(edge.get("type") or "").lower().strip()
        source = str(edge.get("source") or "").strip()
        target = str(edge.get("target") or "").strip()
        if not source or not target or edge_type not in COURSE_GRAPH_EDGE_TYPES or source not in kept_node_ids or target not in kept_node_ids:
            removed_edges.append({
                "source": source,
                "target": target,
                "type": edge_type,
                "label": edge.get("label"),
            })
            continue
        edge["type"] = edge_type
        kept_edges.append(edge)

    if not removed_edges and not removed_nodes:
        return {"repaired": False, "reason": "no_contract_violation", "removedUnsupportedEdges": 0, "removedEvidenceLessNodes": 0}

    repaired = dict(payload)
    repaired["nodes"] = kept_nodes
    repaired["edges"] = kept_edges
    meta = repaired.get("meta") if isinstance(repaired.get("meta"), dict) else {}
    repaired["meta"] = meta | {
        "owner": meta.get("owner") or student_id,
        "scope": meta.get("scope") or "global",
        "contractRepair": {
            "by": "learning-companion-worker",
            "at": now_iso(),
            "reason": "course_graph_contract_repair",
            "removedUnsupportedEdges": len(removed_edges),
            "removedEvidenceLessNodes": len(removed_nodes),
            "removedEdges": removed_edges[:50],
            "removedNodes": removed_nodes[:50],
        },
        "updatedAt": now_iso(),
    }
    save_json_page(
        PATHS["courseGraph"],
        str(repaired.get("title") or "学伴全局知识图谱"),
        repaired,
        topic="graph",
        summary="AI 学伴知识图谱。",
    )
    return {
        "repaired": True,
        "reason": "course_graph_contract_repair",
        "removedUnsupportedEdges": len(removed_edges),
        "removedEvidenceLessNodes": len(removed_nodes),
        "remainingEdges": len(kept_edges),
    }


def filter_known_kp_ids(value: Any, concept_ids: set[str]) -> Any:
    if isinstance(value, list):
        return [item for item in (filter_known_kp_ids(item, concept_ids) for item in value) if item is not None]
    if isinstance(value, dict):
        filtered: dict[str, Any] = {}
        for key, item in value.items():
            filtered_item = filter_known_kp_ids(item, concept_ids)
            if filtered_item is not None:
                filtered[key] = filtered_item
        return filtered
    if isinstance(value, str) and value.startswith("kp:") and value not in concept_ids:
        return None
    return value


def repair_references_to_unknown_l3_ids(student_id: str, graph: dict[str, Any]) -> dict[str, Any]:
    concept_ids = {
        str(node.get("id") or "").strip()
        for node in graph.get("nodes", []) if isinstance(node, dict)
        and str(node.get("type") or "").lower() in L3_NODE_TYPES
        and str(node.get("id") or "").strip().startswith("kp:")
    }
    if not concept_ids:
        return {
            "removedOverlayNodes": 0,
            "removedMetricEvidence": 0,
            "removedMetricRows": 0,
            "rewrittenMemoryPages": [],
        }

    removed_overlay_nodes = 0
    overlay = optional_page_payload(PATHS["studentOverlay"])
    if isinstance(overlay, dict):
        nodes = overlay.get("nodes")
        if isinstance(nodes, dict):
            kept_nodes = {node_id: value for node_id, value in nodes.items() if str(node_id) in concept_ids}
            removed_overlay_nodes = len(nodes) - len(kept_nodes)
            if removed_overlay_nodes:
                repaired_overlay = dict(overlay)
                repaired_overlay["studentId"] = repaired_overlay.get("studentId") or student_id
                repaired_overlay["nodes"] = kept_nodes
                repaired_overlay["updatedAt"] = now_iso()
                repaired_overlay["lastUpdatedBy"] = "workspace_repair:unknown_l3_ids"
                save_json_page(PATHS["studentOverlay"], "AI 学伴 - 学生掌握状态", repaired_overlay, topic="graph", summary="清理不属于当前知识图谱的学生掌握状态。")

    removed_metric_evidence = 0
    removed_metric_rows = 0
    metrics = optional_page_payload(PATHS["evaluationMetrics"])
    if isinstance(metrics, dict):
        repaired_metrics = dict(metrics)
        evidence = metrics.get("evidence") if isinstance(metrics.get("evidence"), list) else []
        kept_evidence = []
        for item in evidence:
            if not isinstance(item, dict):
                removed_metric_evidence += 1
                continue
            repaired_item = filter_known_kp_ids(item, concept_ids)
            linked = repaired_item.get("linkedNodeIds") if isinstance(repaired_item, dict) and isinstance(repaired_item.get("linkedNodeIds"), list) else []
            if linked and is_valid_practice_evidence_item(repaired_item) and practice_score_contract_error(repaired_item) is None:
                kept_evidence.append(repaired_item)
            else:
                removed_metric_evidence += 1
        metric_rows = metrics.get("metrics") if isinstance(metrics.get("metrics"), list) else []
        kept_metric_rows = []
        for item in metric_rows:
            if not isinstance(item, dict):
                removed_metric_rows += 1
                continue
            repaired_item = filter_known_kp_ids(item, concept_ids)
            linked = repaired_item.get("linkedNodeIds") if isinstance(repaired_item, dict) and isinstance(repaired_item.get("linkedNodeIds"), list) else []
            if linked and is_valid_practice_metric_row(repaired_item):
                kept_metric_rows.append(repaired_item)
            else:
                removed_metric_rows += 1
        if removed_metric_evidence or removed_metric_rows:
            repaired_metrics["studentId"] = repaired_metrics.get("studentId") or student_id
            repaired_metrics["evidence"] = kept_evidence
            repaired_metrics["metrics"] = kept_metric_rows
            repaired_metrics["updatedAt"] = now_iso()
            repaired_metrics["lastUpdatedBy"] = "workspace_repair:unknown_l3_ids"
            save_json_page(PATHS["evaluationMetrics"], "AI 学伴 - 学生成长评价指标", repaired_metrics, topic="evaluation", summary="清理不属于当前知识图谱的成长评价引用。")

    rewritten_memory_pages: list[str] = []
    for key, path in MEMORY_PAGE_KEYS.items():
        payload = optional_page_payload(path)
        if not isinstance(payload, dict):
            continue
        repaired_payload = filter_known_kp_ids(payload, concept_ids)
        if isinstance(repaired_payload, dict) and key == "memoryProfile":
            history = repaired_payload.get("practiceHistory") if isinstance(repaired_payload.get("practiceHistory"), list) else []
            repaired_payload["practiceHistory"] = [item for item in history if is_valid_practice_history_item(item)]
        if isinstance(repaired_payload, dict) and key == "memoryReflections":
            reflections = repaired_payload.get("reflections") if isinstance(repaired_payload.get("reflections"), list) else []
            repaired_payload["reflections"] = [item for item in reflections if is_valid_practice_history_item(item)]
        if repaired_payload != payload:
            repaired_payload = dict(repaired_payload)
            repaired_payload["studentId"] = repaired_payload.get("studentId") or student_id
            repaired_payload["updatedAt"] = now_iso()
            repaired_payload["lastUpdatedBy"] = "workspace_repair:unknown_l3_ids"
            save_json_page(path, f"AI 学伴 - {key}", repaired_payload, topic="memory", summary="清理不属于当前知识图谱的记忆引用。")
            rewritten_memory_pages.append(path)

    return {
        "removedOverlayNodes": removed_overlay_nodes,
        "removedMetricEvidence": removed_metric_evidence,
        "removedMetricRows": removed_metric_rows,
        "rewrittenMemoryPages": rewritten_memory_pages,
    }


def repair_workspace_contract(student_id: str) -> dict[str, Any]:
    documents = load_repair_documents()
    graph_repair = repair_course_graph_contract(student_id, documents=documents)
    try:
        graph = optional_page_payload(PATHS["courseGraph"]) or {}
    except InvalidWikiJsonPayload as exc:
        raise RuntimeError(f"workspace repair did not produce valid course graph JSON: {exc}") from exc
    reference_repair = repair_references_to_unknown_l3_ids(student_id, graph)
    overlay = optional_page_payload(PATHS["studentOverlay"]) or {"nodes": {}}
    metrics = optional_page_payload(PATHS["evaluationMetrics"]) or {"evidence": [], "metrics": []}
    memory = load_memory_pages(student_id)
    snapshot = {
        "graph": graph,
        "documents": documents,
        "growthMetrics": metrics,
        "nodeStates": overlay.get("nodes") if isinstance(overlay.get("nodes"), dict) else {},
        "memory": memory,
    }
    quality_error = persistent_workspace_quality_error(snapshot)
    return {
        **graph_repair,
        **reference_repair,
        "repaired": bool(graph_repair.get("repaired") or any(reference_repair.get(key) for key in ("removedOverlayNodes", "removedMetricEvidence", "removedMetricRows", "rewrittenMemoryPages"))),
        "qualityStatus": "valid" if quality_error is None else "invalid",
        "qualityError": quality_error,
        "nodeCount": len(graph.get("nodes") or []),
        "edgeCount": len(graph.get("edges") or []),
        "documentCount": len(snapshot.get("documents") or []),
    }


def normalize_practice_session_payload(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("practice session payload must be an object")
    session = payload.get("practiceSession") if isinstance(payload.get("practiceSession"), dict) else payload
    session_id = str(session.get("sessionId") or "").strip()
    if not session_id:
        raise ValueError("practice session missing sessionId")
    source = str(session.get("source") or "").strip()
    if not source:
        raise ValueError("practice session missing source")
    target_nodes = session.get("targetNodes")
    if not isinstance(target_nodes, list) or not target_nodes:
        raise ValueError("practice session targetNodes must be a non-empty object list")
    normalized_target_nodes: list[dict[str, Any]] = []
    for index, node in enumerate(target_nodes, start=1):
        if not isinstance(node, dict):
            raise ValueError(f"practice session targetNodes[{index}] must be an object")
        node_id = str(node.get("id") or "").strip()
        label = str(node.get("label") or "").strip()
        if not node_id or not label:
            raise ValueError(f"practice session targetNodes[{index}] missing id or label")
        normalized_target_nodes.append(dict(node) | {"id": node_id, "label": label})
    questions = session.get("questions")
    if not isinstance(questions, list) or not questions:
        raise ValueError("practice session questions must be a non-empty list")
    normalized_questions: list[dict[str, Any]] = []
    for index, question in enumerate(questions, start=1):
        if not isinstance(question, dict):
            raise ValueError(f"practice session question {index} must be an object")
        question_id = str(question.get("questionId") or "").strip()
        question_type = str(question.get("type") or "").strip()
        if question_type not in {"single_choice", "multiple_choice", "true_false", "short_answer"}:
            raise ValueError(f"practice session question {index} has unsupported question type")
        if not question_id:
            raise ValueError(f"practice session question {index} missing questionId")
        stem = str(question.get("stem") or "").strip()
        if not stem:
            raise ValueError(f"practice session question {question_id} missing stem")
        node_ids = question.get("nodeIds")
        if not isinstance(node_ids, list) or not any(str(node_id or "").strip() for node_id in node_ids):
            raise ValueError(f"practice session question {question_id} missing nodeIds")
        expected_answer = question.get("expectedAnswer")
        if not isinstance(expected_answer, str) or not expected_answer.strip():
            raise ValueError(f"practice session question {question_id} missing expectedAnswer")
        rubric = question.get("rubric")
        if not isinstance(rubric, str) or not rubric.strip():
            raise ValueError(f"practice session question {question_id} missing rubric")
        normalized_question = dict(question) | {
            "questionId": question_id,
            "type": question_type,
            "stem": stem,
            "nodeIds": [str(node_id).strip() for node_id in node_ids if str(node_id or "").strip()],
            "expectedAnswer": expected_answer.strip(),
            "rubric": rubric.strip(),
        }
        if question_type in {"single_choice", "multiple_choice", "true_false"}:
            options = question.get("options")
            if not isinstance(options, list) or len(options) < 2:
                raise ValueError(f"practice session question {question_id} missing options")
            normalized_options: list[dict[str, str]] = []
            for option_index, option in enumerate(options, start=1):
                if not isinstance(option, dict):
                    raise ValueError(f"practice session question {question_id} option {option_index} must be an object")
                key = str(option.get("key") or "").strip()
                text = str(option.get("text") or "").strip()
                if not key or not text:
                    raise ValueError(f"practice session question {question_id} option {option_index} missing key or text")
                normalized_options.append({"key": key, "text": text})
            if question_type == "true_false" and {item["key"] for item in normalized_options} != {"true", "false"}:
                raise ValueError(f"practice session question {question_id} true_false options must use true/false keys")
            option_keys = {normalized_choice_answer(item["key"]) for item in normalized_options}
            expected_keys = set(normalized_choice_keys(expected_answer))
            if not expected_keys or not expected_keys <= option_keys:
                raise ValueError(f"practice session question {question_id} expectedAnswer must match option key")
            if question_type in {"single_choice", "true_false"} and len(expected_keys) != 1:
                raise ValueError(f"practice session question {question_id} expectedAnswer must contain one option key")
            normalized_question["options"] = normalized_options
        elif "options" in normalized_question:
            raise ValueError(f"practice session question {question_id} short_answer must not include options")
        normalized_questions.append(normalized_question)
    return dict(session) | {
        "sessionId": session_id,
        "source": source,
        "targetNodes": normalized_target_nodes,
        "questions": normalized_questions,
    }


def validate_practice_submit_contract(
    session_id: str,
    session_payload: dict[str, Any],
    answers: list[Any],
    active_practice_session: Any = None,
) -> None:
    normalized_session = normalize_practice_session_payload(session_payload)
    if normalized_session.get("sessionId") != session_id:
        raise ValueError("practice session route id does not match persisted session")
    question_ids = {
        str(question.get("questionId") or "").strip()
        for question in normalized_session.get("questions") or []
        if str(question.get("questionId") or "").strip()
    }
    answer_ids: list[str] = []
    for index, item in enumerate(answers, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"practice submit answer {index} must be an object")
        question_id = str(item.get("questionId") or item.get("question_id") or "").strip()
        answer = str(item.get("answer") or "").strip()
        if not question_id:
            raise ValueError(f"practice submit answer {index} missing questionId")
        if not answer:
            raise ValueError(f"practice submit answer {question_id} missing answer")
        if question_id not in question_ids:
            raise ValueError(f"practice submit answer {question_id} does not belong to session {session_id}")
        answer_ids.append(question_id)
    if not answer_ids:
        raise ValueError("practice submit answers must not be empty")
    if active_practice_session is None:
        return
    if not isinstance(active_practice_session, dict):
        raise ValueError("activePracticeSession must be an object")
    active_session_id = str(active_practice_session.get("serverSessionId") or active_practice_session.get("sessionId") or "").strip()
    if active_session_id != session_id:
        raise ValueError("activePracticeSession does not match submitted session")
    active_questions = active_practice_session.get("questions")
    if not isinstance(active_questions, list) or not active_questions:
        raise ValueError("activePracticeSession questions must be a non-empty list")
    active_question_ids: set[str] = set()
    for index, question in enumerate(active_questions, start=1):
        if not isinstance(question, dict):
            raise ValueError(f"activePracticeSession question {index} must be an object")
        question_id = str(question.get("questionId") or question.get("id") or "").strip()
        if not question_id:
            raise ValueError(f"activePracticeSession question {index} missing questionId")
        if question_id not in question_ids:
            raise ValueError(f"activePracticeSession question {question_id} does not belong to session {session_id}")
        active_question_ids.add(question_id)
    missing_answer_questions = set(answer_ids) - active_question_ids
    if missing_answer_questions:
        missing = ", ".join(sorted(missing_answer_questions))
        raise ValueError(f"activePracticeSession missing submitted question(s): {missing}")


def normalize_practice_result_payload(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("practice result payload must be an object")
    result = payload.get("practiceResult") if isinstance(payload.get("practiceResult"), dict) else payload
    session_id = str(result.get("sessionId") or "").strip()
    attempt_id = str(result.get("attemptId") or "").strip()
    student_id = str(result.get("studentId") or "").strip()
    if not session_id:
        raise ValueError("practice result missing sessionId")
    if not attempt_id:
        raise ValueError("practice result missing attemptId")
    if not student_id:
        raise ValueError("practice result missing studentId")
    answers = result.get("answers")
    if not isinstance(answers, list):
        raise ValueError("practice result answers must be a list")
    question_results = result.get("questionResults")
    if not isinstance(question_results, list) or not question_results:
        raise ValueError("practice result missing questionResults")
    normalized_question_results: list[dict[str, Any]] = []
    linked_node_ids: list[str] = []
    for index, question in enumerate(question_results, start=1):
        if not isinstance(question, dict):
            raise ValueError(f"practice result questionResults[{index}] must be an object")
        question_id = str(question.get("questionId") or "").strip()
        if not question_id:
            raise ValueError(f"practice result questionResults[{index}] missing questionId")
        if not isinstance(question.get("correct"), bool):
            raise ValueError(f"practice result questionResults[{question_id}] correct must be boolean")
        feedback = str(question.get("feedback") or "").strip()
        if not feedback:
            raise ValueError(f"practice result questionResults[{question_id}] missing feedback")
        node_ids = question.get("linkedNodeIds")
        if not isinstance(node_ids, list) or not any(str(node_id or "").strip() for node_id in node_ids):
            raise ValueError(f"practice result questionResults[{question_id}] missing linkedNodeIds")
        normalized_node_ids = [str(node_id).strip() for node_id in node_ids if str(node_id or "").strip()]
        linked_node_ids.extend(normalized_node_ids)
        normalized_question_results.append(dict(question) | {
            "questionId": question_id,
            "feedback": feedback,
            "linkedNodeIds": normalized_node_ids,
        })
    wrong_node_ids = result.get("wrongNodeIds")
    if not isinstance(wrong_node_ids, list):
        raise ValueError("practice result wrongNodeIds must be a list")
    mastery_updates = result.get("masteryUpdates")
    if not isinstance(mastery_updates, list):
        raise ValueError("practice result masteryUpdates must be a list")
    normalized_updates: list[dict[str, Any]] = []
    for index, update in enumerate(mastery_updates, start=1):
        if not isinstance(update, dict):
            raise ValueError(f"practice result masteryUpdates[{index}] must be an object")
        node_id = str(update.get("nodeId") or "").strip()
        if not node_id:
            raise ValueError(f"practice result masteryUpdates[{index}] missing nodeId")
        new_mastery = update.get("newMastery")
        if not isinstance(new_mastery, (int, float)):
            raise ValueError(f"practice result masteryUpdates[{node_id}] missing newMastery")
        if isinstance(new_mastery, bool) or not math.isfinite(float(new_mastery)) or int(new_mastery) != new_mastery or new_mastery < 0 or new_mastery > 100:
            raise ValueError(f"practice result masteryUpdates[{node_id}] newMastery must be an integer percentage from 0 to 100")
        new_confidence = update.get("newConfidence")
        if not isinstance(new_confidence, (int, float)):
            raise ValueError(f"practice result masteryUpdates[{node_id}] missing newConfidence")
        if isinstance(new_confidence, bool) or not math.isfinite(float(new_confidence)) or new_confidence < 0 or new_confidence > 1:
            raise ValueError(f"practice result masteryUpdates[{node_id}] newConfidence must be between 0 and 1")
        reason = str(update.get("reason") or "").strip()
        if not reason:
            raise ValueError(f"practice result masteryUpdates[{node_id}] missing reason")
        normalized_updates.append(dict(update) | {"nodeId": node_id, "newMastery": int(new_mastery), "newConfidence": float(new_confidence), "reason": reason})
    score_value = result_score_value(dict(result))
    if score_value < 0 or score_value > 1:
        raise ValueError("practice result score must be between 0 and 1")
    return dict(result) | {
        "sessionId": session_id,
        "attemptId": attempt_id,
        "studentId": student_id,
        "answers": answers,
        "score": result.get("score"),
        "questionResults": normalized_question_results,
        "wrongNodeIds": [str(node_id).strip() for node_id in wrong_node_ids if str(node_id or "").strip()],
        "masteryUpdates": normalized_updates,
        "linkedNodeIds": list(dict.fromkeys(linked_node_ids)),
    }


def normalize_practice_result_document_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return normalize_practice_result_payload(payload)


def normalized_answer_text(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (list, tuple, set)):
        return ",".join(sorted(str(item).strip() for item in value if str(item).strip()))
    return str(value or "").strip()


def normalized_choice_answer(value: Any) -> str:
    return normalized_answer_text(value).replace("，", ",").replace(" ", "").upper()


def normalized_choice_keys(value: Any) -> list[str]:
    text = normalized_choice_answer(value)
    if not text:
        return []
    return [item for item in text.split(",") if item]


def chinese_text_tokens(value: str) -> set[str]:
    text = re.sub(r"\s+", "", str(value or "").lower())
    tokens = {item for item in re.split(r"[^0-9a-zA-Z\u4e00-\u9fff]+", str(value or "").lower()) if len(item) >= 2}
    for index in range(max(0, len(text) - 1)):
        fragment = text[index:index + 2]
        if re.search(r"[\u4e00-\u9fff]", fragment):
            tokens.add(fragment)
    return tokens


def grade_short_answer(answer: Any, expected_answer: str) -> bool:
    answer_text = normalized_answer_text(answer)
    expected_text = str(expected_answer or "").strip()
    if not answer_text or not expected_text:
        return False
    if expected_text in answer_text or answer_text in expected_text:
        return True
    expected_tokens = chinese_text_tokens(expected_text)
    answer_tokens = chinese_text_tokens(answer_text)
    if not expected_tokens or not answer_tokens:
        return False
    overlap = len(expected_tokens & answer_tokens)
    required = max(2, min(6, math.ceil(len(expected_tokens) * 0.28)))
    return overlap >= required


def answer_matches_question(question: dict[str, Any], answer: Any) -> bool:
    question_type = str(question.get("type") or "").strip()
    expected = str(question.get("expectedAnswer") or "").strip()
    if question_type == "single_choice":
        return normalized_choice_keys(answer) == normalized_choice_keys(expected)
    if question_type == "multiple_choice":
        return sorted(normalized_choice_keys(answer)) == sorted(normalized_choice_keys(expected))
    if question_type == "true_false":
        return normalized_answer_text(answer).lower() == expected.lower()
    if question_type == "short_answer":
        return grade_short_answer(answer, expected)
    return False


def practice_feedback(question: dict[str, Any], correct: bool) -> str:
    rubric = str(question.get("rubric") or "").strip()
    expected = str(question.get("expectedAnswer") or "").strip()
    if correct:
        return "回答正确，已符合本题评分标准。"
    if rubric:
        return f"未达到评分标准：{rubric[:52]}"
    if expected:
        return f"请对照参考答案：{expected[:52]}"
    return "答案与本题标准不一致，需要复习对应知识点。"


def practice_result_summary(result: dict[str, Any]) -> str:
    question_results = result.get("questionResults") if isinstance(result.get("questionResults"), list) else []
    total = len(question_results)
    correct = sum(1 for item in question_results if isinstance(item, dict) and item.get("correct") is True)
    if total <= 0:
        return "本次练习已提交。"
    return f"本次练习答对 {correct}/{total}。"


def practice_result_next_action(result: dict[str, Any]) -> str:
    question_results = result.get("questionResults") if isinstance(result.get("questionResults"), list) else []
    wrong_indexes = [
        str(index)
        for index, item in enumerate(question_results, start=1)
        if isinstance(item, dict) and item.get("correct") is not True
    ]
    if wrong_indexes:
        return f"请优先回顾第 {'、'.join(wrong_indexes)} 题关联知识点，再做一轮同类练习。"
    return "继续完成下一轮练习，或让学伴讲解本题的关键知识点。"


def practice_generation_pending_summary() -> str:
    return "题目正在生成，完成后会自动出现在练习区。"


def practice_generation_ready_summary(session: dict[str, Any]) -> str:
    questions = session.get("questions") if isinstance(session.get("questions"), list) else []
    return f"已生成 {len(questions)} 道练习题。"


def overlay_node_state_by_id() -> dict[str, dict[str, Any]]:
    try:
        overlay = optional_page_payload(PATHS["studentOverlay"])
    except Exception:
        return {}
    if not isinstance(overlay, dict):
        return {}
    nodes = overlay.get("nodes")
    if isinstance(nodes, dict):
        return {str(node_id): state for node_id, state in nodes.items() if isinstance(state, dict)}
    nested = overlay.get("overlay")
    nested_nodes = nested.get("nodes") if isinstance(nested, dict) else None
    if isinstance(nested_nodes, dict):
        return {str(node_id): state for node_id, state in nested_nodes.items() if isinstance(state, dict)}
    return {}


def mastery_value_for_accuracy(accuracy: float, current_mastery: Any = None) -> int:
    normalized = max(0.0, min(1.0, accuracy))
    has_prior = isinstance(current_mastery, (int, float)) and not isinstance(current_mastery, bool)
    base = float(current_mastery) if has_prior else 45.0
    delta = round(normalized * 23 - 15) if has_prior else round((normalized - 0.5) * 30)
    return int(max(0, min(100, round(base + delta))))


def confidence_value_for_accuracy(accuracy: float, current_confidence: Any = None) -> float:
    normalized = max(0.0, min(1.0, accuracy))
    has_prior = isinstance(current_confidence, (int, float)) and not isinstance(current_confidence, bool)
    base = float(current_confidence) if has_prior else 0.6
    delta = normalized * 0.18 - 0.12 if has_prior else (normalized - 0.5) * 0.16
    return round(max(0.0, min(1.0, base + delta)), 2)


def grade_practice_session_locally(
    student_id: str,
    session: dict[str, Any],
    attempt_id: str,
    answers: list[Any],
) -> dict[str, Any]:
    normalized_session = normalize_practice_session_payload(session)
    answer_by_question: dict[str, Any] = {}
    for item in answers:
        if isinstance(item, dict):
            question_id = str(item.get("questionId") or item.get("question_id") or "").strip()
            if question_id:
                answer_by_question[question_id] = item.get("answer")
    question_results: list[dict[str, Any]] = []
    wrong_node_ids: list[str] = []
    linked_node_outcomes: dict[str, list[bool]] = {}
    overlay_nodes = overlay_node_state_by_id()
    for question in normalized_session.get("questions") or []:
        question_id = str(question.get("questionId") or "").strip()
        submitted_answer = answer_by_question.get(question_id)
        correct = answer_matches_question(question, submitted_answer)
        linked_node_ids = [str(node_id) for node_id in question.get("nodeIds") or [] if str(node_id or "").strip()]
        for node_id in linked_node_ids:
            linked_node_outcomes.setdefault(node_id, []).append(correct)
            if not correct and node_id not in wrong_node_ids:
                wrong_node_ids.append(node_id)
        question_results.append({
            "questionId": question_id,
            "correct": correct,
            "feedback": practice_feedback(question, correct),
            "linkedNodeIds": linked_node_ids,
        })
    correct_count = sum(1 for item in question_results if item.get("correct") is True)
    total_count = len(question_results) or 1
    mastery_updates = []
    for node_id, outcomes in linked_node_outcomes.items():
        accuracy = sum(1 for outcome in outcomes if outcome) / len(outcomes)
        state = overlay_nodes.get(node_id, {})
        mastery_updates.append({
            "nodeId": node_id,
            "newMastery": mastery_value_for_accuracy(accuracy, state.get("mastery")),
            "newConfidence": confidence_value_for_accuracy(accuracy, state.get("confidence")),
            "reason": "本轮答对相关题目。" if accuracy >= 1.0 else "本轮存在错答，需复习。",
        })
    result = {
        "sessionId": normalized_session["sessionId"],
        "attemptId": str(attempt_id),
        "studentId": str(student_id),
        "submittedAt": now_iso(),
        "practiceSession": f"wiki/pages/practice-sessions/{normalized_session['sessionId']}.md",
        "answers": [
            {"questionId": str(item.get("questionId") or item.get("question_id") or ""), "answer": item.get("answer")}
            for item in answers
            if isinstance(item, dict) and str(item.get("questionId") or item.get("question_id") or "").strip()
        ],
        "score": correct_count / total_count,
        "questionResults": question_results,
        "wrongNodeIds": wrong_node_ids,
        "masteryUpdates": mastery_updates,
    }
    return normalize_practice_result_payload(result)


def persist_practice_result(student_id: str, session_id: str, attempt_id: str, result: dict[str, Any]) -> dict[str, Any]:
    result_path = f"wiki/pages/practice-results/{attempt_id}.md"
    if optional_page_payload(result_path) is not None:
        raise RuntimeError(f"practice result already exists: {attempt_id}")
    normalized_result = normalize_practice_result_payload(result)
    save_json_page(
        result_path,
        f"练习批改结果 - {session_id}",
        normalized_result,
        topic="practice_result",
        summary=f"练习提交批改结果：得分 {result_score_value(normalized_result):.2f}。",
    )
    return normalized_result


def page_to_document(page: dict[str, Any], index: int) -> dict[str, Any] | None:
    path = canonical_wiki_page_path(str(page.get("path") or ""))
    if not path or is_system_page_path(path):
        return None
    frontmatter = markdown_frontmatter(page.get("content"))
    title = str(page.get("title") or frontmatter.get("title") or path.rsplit("/", 1)[-1] or "Wiki 页面")
    raw_payload = page_payload(page)
    payload = raw_payload if isinstance(raw_payload, dict) else {}
    linked_node_ids = payload.get("linkedNodeIds") if isinstance(payload.get("linkedNodeIds"), list) else frontmatter.get("linkedNodeIds")
    if not isinstance(linked_node_ids, list):
        linked_node_ids = []
    summary = str(page.get("summary") or payload.get("summary") or frontmatter.get("summary") or f"LLM-Wiki 页面：{title}")
    topic = str(page.get("topic") or payload.get("topic") or frontmatter.get("topic") or "学伴")
    kind = "practice" if "/practice-" in path or "/practice/" in path else "wiki" if path.endswith(".md") else "file"
    document = {
        "id": f"wiki-{re.sub(r'[^A-Za-z0-9_.-]+', '-', path).strip('-') or index}",
        "title": title,
        "path": path,
        "kind": kind,
        "summary": summary,
        "linkedNodeIds": linked_node_ids,
        "updatedAt": page.get("updated_at") or page.get("updatedAt"),
        "usage": ["资料", "引用"],
        "tags": ["LLM-Wiki", topic],
    }
    if "practice-sessions/" in path and isinstance(raw_payload, dict):
        practice_session = payload.get("practiceSession") if isinstance(payload.get("practiceSession"), dict) else payload
        try:
            practice_session = normalize_practice_session_payload(practice_session)
        except ValueError as exc:
            document["kind"] = "practice_session_invalid"
            document["practiceSessionInvalid"] = {"reason": str(exc)}
            document["summary"] = f"无效练习会话：{exc}"
        else:
            document["kind"] = "practice_session"
            document["practiceSession"] = practice_session
            document["linkedNodeIds"] = [
                node["id"]
                for node in practice_session.get("targetNodes", [])
                if isinstance(node, dict) and isinstance(node.get("id"), str)
            ]
            document["summary"] = f"练习会话：{len(practice_session.get('questions') or [])} 道题。"
    elif "practice-sessions/" in path:
        reason = json_payload_error(page.get("content")) or "practice session payload must be an object"
        document["kind"] = "practice_session_invalid"
        document["practiceSessionInvalid"] = {"reason": reason}
        document["summary"] = f"无效练习会话：{reason}"
    if "practice-results/" in path and isinstance(raw_payload, dict):
        practice_result = payload.get("practiceResult") if isinstance(payload.get("practiceResult"), dict) else payload
        try:
            practice_result = normalize_practice_result_document_payload(practice_result)
        except ValueError as exc:
            document["kind"] = "practice_result_invalid"
            document["practiceResultInvalid"] = {"reason": str(exc)}
            document["summary"] = f"无效练习批改结果：{exc}"
        else:
            document["kind"] = "practice_result"
            document["practiceResult"] = practice_result
            document["linkedNodeIds"] = practice_result.get("linkedNodeIds") if isinstance(practice_result.get("linkedNodeIds"), list) else []
            document["summary"] = f"练习批改结果：得分 {result_score_value(practice_result):.2f}。"
            document["updatedAt"] = practice_result.get("submittedAt") or practice_result.get("gradedAt") or document["updatedAt"]
    elif "practice-results/" in path:
        reason = json_payload_error(page.get("content")) or "practice result payload must be an object"
        document["kind"] = "practice_result_invalid"
        document["practiceResultInvalid"] = {"reason": reason}
        document["summary"] = f"无效练习批改结果：{reason}"
    return document


def document_recency_key(document: dict[str, Any]) -> str:
    practice_result = document.get("practiceResult")
    if isinstance(practice_result, dict):
        for key in ("submittedAt", "submitted_at", "gradedAt", "graded_at", "updatedAt", "updated_at", "createdAt", "created_at"):
            raw = practice_result.get(key)
            if isinstance(raw, str) and raw.strip():
                return raw.strip()
    raw = document.get("updatedAt")
    return raw.strip() if isinstance(raw, str) else ""


def load_documents(wiki_pages: dict[str, Any], include_library: bool = True) -> list[dict[str, Any]]:
    documents: list[dict[str, Any]] = []
    seen: set[str] = set()
    pages = first_page_list(wiki_pages) if include_library else []
    required = [PATHS["courseGraph"], PATHS["studentOverlay"], PATHS["evaluationMetrics"]]
    for path in [*(canonical_wiki_page_path(str(page.get("path") or "")) for page in pages), *required]:
        if not path or path in seen:
            continue
        seen.add(path)
        if is_system_page_path(path):
            continue
        try:
            page = get_page(path)
        except Exception as exc:
            if missing_wiki_page(exc):
                continue
            raise
        doc = page_to_document(page, len(documents) + 1)
        if doc:
            documents.append(doc)
    return sorted(documents, key=document_recency_key, reverse=True)


def _evidence_at(value: dict[str, Any], fallback: str | None = None) -> str:
    for key in ("at", "timestamp", "createdAt", "created_at", "updatedAt", "updated_at", "submittedAt", "submitted_at"):
        raw = value.get(key)
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return fallback or now_iso()


def _score_detail(result: dict[str, Any], fallback: str) -> str:
    score = result.get("score") if isinstance(result.get("score"), dict) else {}
    correct = score.get("correct")
    total = score.get("total")
    if isinstance(correct, (int, float)) and isinstance(total, (int, float)):
        return f"练习已批改：答对 {correct}/{total}。"
    return fallback


GROWTH_BADGE_SCALE = {
    "star": 1,
    "moon": 4,
    "sun": 16,
    "crown": 64,
}

GROWTH_POINT_RULES = [
    {
        "kind": "practice_result",
        "label": "完成练习并提交答案",
        "points": "每题 2 分，答对额外 +1 分",
        "description": "鼓励学生把题做完并提交，正确率越高成长值越高。",
        "audit": "来自 practiceResult.score.correct / total，按会话去重。",
    },
    {
        "kind": "knowledge_report",
        "label": "沉淀一份知识点报告",
        "points": "1-5 分",
        "description": "鼓励把学到的内容整理成可复习的 Wiki 知识点报告。",
        "audit": "按报告路径稳定计算 1-5 分，同一报告不会因刷新重复或变分。",
    },
    {
        "kind": "chapter_complete",
        "label": "完成一个课程章节学习",
        "points": "12 分",
        "description": "章节学习代表完成一段连续学习路径，分值高于零散问答。",
        "audit": "来自 chapter_complete / lesson_complete / unit_complete 成长证据。",
    },
    {
        "kind": "review_complete",
        "label": "完成一次复习闭环或错因订正",
        "points": "6 分",
        "description": "复习和订正直接帮助把薄弱点转成稳定掌握。",
        "audit": "来自 review / mistake / correction 类成长证据。",
    },
    {
        "kind": "research",
        "label": "完成一次深度研究",
        "points": "5 分",
        "description": "鼓励围绕一个知识点做进一步解释、比较或迁移。",
        "audit": "来自 research 类成长证据。",
    },
    {
        "kind": "qa",
        "label": "完成一次有效问答",
        "points": "1 分",
        "description": "有效问答是轻量学习动作，用于维持学习连续性。",
        "audit": "来自其他可识别学习事件，按事件 ID 去重。",
    },
]


def stable_report_points(seed: str) -> int:
    digest = hashlib.sha256(str(seed or "knowledge-report").encode("utf-8")).hexdigest()
    return 1 + (int(digest[:8], 16) % 5)


def qq_growth_emblems(total_points: int) -> dict[str, int]:
    remaining = max(0, int(total_points))
    crown, remaining = divmod(remaining, GROWTH_BADGE_SCALE["crown"])
    sun, remaining = divmod(remaining, GROWTH_BADGE_SCALE["sun"])
    moon, star = divmod(remaining, GROWTH_BADGE_SCALE["moon"])
    return {"crown": crown, "sun": sun, "moon": moon, "star": star}


def growth_title(emblems: dict[str, int]) -> str:
    parts: list[str] = []
    if emblems.get("crown"):
        parts.append(f"{emblems['crown']} 皇冠")
    if emblems.get("sun"):
        parts.append(f"{emblems['sun']} 太阳")
    if emblems.get("moon"):
        parts.append(f"{emblems['moon']} 月亮")
    if emblems.get("star"):
        parts.append(f"{emblems['star']} 星星")
    return " · ".join(parts) if parts else "0 星星"


def _practice_score(result: dict[str, Any]) -> tuple[int, int]:
    score = result.get("score") if isinstance(result.get("score"), dict) else {}
    correct = score.get("correct")
    total = score.get("total")
    if isinstance(correct, (int, float)) and isinstance(total, (int, float)):
        total_int = max(0, int(total))
        return max(0, min(int(correct), total_int)), total_int
    answers = result.get("answers") if isinstance(result.get("answers"), list) else []
    total_answers = len(answers)
    correct_answers = sum(1 for item in answers if isinstance(item, dict) and item.get("correct") is True)
    return correct_answers, total_answers


def practice_session_question_counts(documents: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for doc in documents:
        session = doc.get("practiceSession") if isinstance(doc.get("practiceSession"), dict) else None
        if not session:
            continue
        session_id = str(session.get("sessionId") or session.get("id") or "").strip()
        questions = session.get("questions") if isinstance(session.get("questions"), list) else []
        if session_id and questions:
            counts[session_id] = len(questions)
    return counts


def bounded_practice_score(result: dict[str, Any], question_counts: dict[str, int]) -> tuple[int, int]:
    correct, total = _practice_score(result)
    session_id = str(result.get("sessionId") or result.get("id") or "").strip()
    expected_total = question_counts.get(session_id)
    if expected_total is not None:
        total = min(total, expected_total)
    total = min(max(0, total), 50)
    correct = min(max(0, correct), total)
    return correct, total


def next_growth_milestone(total_points: int) -> dict[str, Any]:
    total = max(0, int(total_points))
    if total < GROWTH_BADGE_SCALE["moon"]:
        target = GROWTH_BADGE_SCALE["moon"]
        base = 0
        label = "月亮"
    elif total < GROWTH_BADGE_SCALE["sun"]:
        target = GROWTH_BADGE_SCALE["sun"]
        base = GROWTH_BADGE_SCALE["moon"]
        label = "太阳"
    elif total < GROWTH_BADGE_SCALE["crown"]:
        target = GROWTH_BADGE_SCALE["crown"]
        base = GROWTH_BADGE_SCALE["sun"]
        label = "皇冠"
    else:
        crown = total // GROWTH_BADGE_SCALE["crown"]
        base = crown * GROWTH_BADGE_SCALE["crown"]
        target = (crown + 1) * GROWTH_BADGE_SCALE["crown"]
        label = "皇冠"

    span = max(1, target - base)
    progress = round(((total - base) / span) * 100)
    return {
        "label": label,
        "targetPoints": target,
        "remaining": max(0, target - total),
        "progress": max(0, min(100, progress)),
    }


def workspace_growth_points(documents: list[dict[str, Any]], growth_evidence: list[dict[str, Any]]) -> dict[str, Any]:
    events: list[dict[str, Any]] = []
    seen: set[str] = set()
    question_counts = practice_session_question_counts(documents)

    def add_event(event_id: str, kind: str, title: str, points: int, at: str, detail: str) -> None:
        normalized_id = str(event_id or "").strip()
        if not normalized_id or normalized_id in seen or points <= 0:
            return
        seen.add(normalized_id)
        events.append({
            "id": normalized_id,
            "kind": kind,
            "title": str(title or kind),
            "points": int(points),
            "at": at,
            "detail": str(detail or ""),
        })

    for doc in documents:
        path = str(doc.get("path") or doc.get("id") or "")
        title = str(doc.get("title") or path or "学习记录")
        at = _evidence_at(doc)
        practice_result = doc.get("practiceResult") if isinstance(doc.get("practiceResult"), dict) else None
        if practice_result:
            correct, total = bounded_practice_score(practice_result, question_counts)
            if total <= 0:
                continue
            points = total * 2 + correct
            add_event(
                f"practice-result:{practice_result.get('sessionId') or path}",
                "practice_result",
                title,
                points,
                at,
                f"完成 {total} 道题，答对 {correct} 道，获得 {points} 成长值。",
            )
            continue
        if path.startswith("wiki/pages/notes/"):
            points = stable_report_points(path)
            add_event(
                f"knowledge-report:{path}",
                "knowledge_report",
                title,
                points,
                at,
                f"沉淀知识点报告，稳定奖励 {points} 成长值。",
            )

    for item in growth_evidence:
        kind = str(item.get("kind") or "").lower()
        event_id = str(item.get("id") or item.get("source") or item.get("title") or kind)
        title = str(item.get("title") or item.get("source") or kind or "学习事件")
        detail = str(item.get("detail") or "")
        at = _evidence_at(item)
        if kind in {"practice_result", "practice_session", "knowledge_ingest", "knowledge_report"}:
            continue
        if kind in {"chapter_complete", "lesson_complete", "unit_complete"}:
            add_event(f"chapter-complete:{event_id}", "chapter_complete", title, 12, at, detail or "完成一个章节学习，获得 12 成长值。")
        elif "review" in kind or "mistake" in kind or "correction" in kind:
            add_event(f"review-complete:{event_id}", "review_complete", title, 6, at, detail or "完成一次复习或错因订正，获得 6 成长值。")
        elif "research" in kind:
            add_event(f"research:{event_id}", "research", title, 5, at, detail or "完成一次深度研究，获得 5 成长值。")
        elif kind:
            add_event(f"qa:{event_id}", "qa", title, 1, at, detail or "完成一次有效学习问答，获得 1 成长值。")

    events.sort(key=lambda item: str(item.get("at") or ""), reverse=True)
    total = sum(int(item.get("points") or 0) for item in events)
    emblems = qq_growth_emblems(total)
    remainder_to_sun = total % 16
    milestone = next_growth_milestone(total)
    return {
        "version": "learning-companion-growth-points-v1",
        "total": total,
        "level": total // 16 + 1,
        "title": growth_title(emblems),
        "emblems": emblems,
        "badgeScale": GROWTH_BADGE_SCALE,
        "nextMilestone": milestone,
        "progressToNextSun": round((remainder_to_sun / 16) * 100),
        "remainingToNextSun": 16 - remainder_to_sun if remainder_to_sun else 16,
        "pointEvents": events[:50],
        "rules": GROWTH_POINT_RULES,
        "security": GROWTH_SECURITY_POLICY,
    }


def workspace_growth_evidence(metrics: dict[str, Any], documents: list[dict[str, Any]], fallback_at: str) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for index, item in enumerate(metrics.get("evidence") if isinstance(metrics.get("evidence"), list) else []):
        if not isinstance(item, dict):
            continue
        kind = str(item.get("kind") or item.get("type") or "wiki").strip() or "wiki"
        source = item.get("source")
        note = item.get("note")
        normalized.append({
            "id": item.get("id") or item.get("eventId") or f"metric-evidence-{index + 1}",
            "title": item.get("title") or source or f"成长证据 {index + 1}",
            "detail": item.get("detail") or item.get("summary") or note or source or "LLM-Wiki 成长证据",
            "at": _evidence_at(item, fallback_at),
            "kind": kind,
            "source": source,
            "linkedNodeIds": item.get("linkedNodeIds") if isinstance(item.get("linkedNodeIds"), list) else [],
        })
    for doc in documents:
        path = str(doc.get("path") or "")
        title = str(doc.get("title") or path or "学习资料")
        at = _evidence_at(doc, fallback_at)
        if isinstance(doc.get("practiceResult"), dict):
            normalized.append({
                "id": f"doc:{path}",
                "title": title,
                "detail": _score_detail(doc["practiceResult"], str(doc.get("summary") or path)),
                "at": at,
                "kind": "practice_result",
                "source": path,
                "linkedNodeIds": doc.get("linkedNodeIds") if isinstance(doc.get("linkedNodeIds"), list) else [],
            })
        elif isinstance(doc.get("practiceSession"), dict):
            questions = doc["practiceSession"].get("questions")
            question_count = len(questions) if isinstance(questions, list) else 0
            normalized.append({
                "id": f"doc:{path}",
                "title": title,
                "detail": f"AI 已生成 {question_count} 道练习题，等待学生完成作答。",
                "at": at,
                "kind": "practice_session",
                "source": path,
                "linkedNodeIds": doc.get("linkedNodeIds") if isinstance(doc.get("linkedNodeIds"), list) else [],
            })
    rank = {"practice_result": 4, "practice_session": 3, "knowledge_ingest": 2, "review": 1}
    normalized.sort(key=lambda item: (rank.get(str(item.get("kind") or ""), 0), str(item.get("at") or "")), reverse=True)
    return normalized


def workspace_action_counts(documents: list[dict[str, Any]], growth_evidence: list[dict[str, Any]]) -> dict[str, int]:
    counts = {
        "practice": sum(1 for doc in documents if isinstance(doc.get("practiceSession"), dict)),
        "practiceResult": sum(1 for doc in documents if isinstance(doc.get("practiceResult"), dict)),
        "qa": 0,
        "research": 0,
        "review": 0,
    }
    for item in growth_evidence:
        kind = str(item.get("kind") or "").lower()
        if kind in {"practice_session", "practice-result", "practice_result"}:
            continue
        if "review" in kind:
            counts["review"] += 1
        elif "research" in kind:
            counts["research"] += 1
        else:
            counts["qa"] += 1
    return counts


def graph_hierarchy(graph: dict[str, Any], documents: list[dict[str, Any]], node_states: dict[str, dict[str, Any]]) -> dict[str, Any]:
    nodes = [item for item in graph.get("nodes", []) if isinstance(item, dict)]
    edges = [item for item in graph.get("edges", []) if isinstance(item, dict)]
    subject_types = {"subject"}
    unit_types = {"unit", "chapter", "lesson"}
    subjects = [dict(item, hierarchyLevel=1, type=item.get("type") or "subject") for item in nodes if str(item.get("type") or "").lower() in subject_types]
    units = [dict(item, hierarchyLevel=2, type=item.get("type") or "unit") for item in nodes if str(item.get("type") or "").lower() in unit_types]
    concepts = [
        dict(item, hierarchyLevel=3, type=item.get("type") or "concept")
        for item in nodes
        if str(item.get("type") or "").lower() not in subject_types | unit_types
    ]
    unit_ids = {str(unit.get("id") or "") for unit in units}
    incoming_contains: dict[str, list[str]] = {}
    for edge in edges:
        if str(edge.get("type") or "").lower() != "contains":
            continue
        target = str(edge.get("target") or "")
        source = str(edge.get("source") or "")
        if target and source:
            incoming_contains.setdefault(target, []).append(source)
    for concept in concepts:
        state = node_states.get(str(concept.get("id") or "")) or {}
        concept.update({key: state[key] for key in ("mastery", "reviewPriority", "mistakeCount") if key in state})
        parent_id = str(concept.get("unitId") or concept.get("parentId") or "")
        if not parent_id:
            for source in incoming_contains.get(str(concept.get("id") or ""), []):
                if source in unit_ids:
                    parent_id = source
                    break
        if parent_id:
            concept["parentId"] = parent_id
    evidence = []
    concept_ids = {str(item.get("id") or "") for item in concepts}
    hierarchy_edges = list(edges)
    for index, doc in enumerate(documents):
        links = [str(item) for item in doc.get("linkedNodeIds", []) if str(item) in concept_ids]
        if not links:
            continue
        evidence_id = f"evidence:{index + 1}"
        evidence.append({
            "id": evidence_id,
            "label": doc.get("title") or doc.get("path") or evidence_id,
            "type": "evidence",
            "hierarchyLevel": 4,
            "parentId": links[0],
            "path": doc.get("path"),
            "kind": doc.get("kind"),
            "summary": doc.get("summary"),
            "linkedNodeIds": links,
        })
        hierarchy_edges.append({"source": links[0], "target": evidence_id, "type": "contains", "label": "证据"})
    visible_nodes = [*subjects, *units, *concepts, *evidence]
    return {
        "version": "learning-companion-kg-v3",
        "layers": [
            {"id": "subject", "label": "学科", "level": 1, "nodeCount": len(subjects)},
            {"id": "unit", "label": "主题/章节", "level": 2, "nodeCount": len(units)},
            {"id": "concept", "label": "知识点", "level": 3, "nodeCount": len(concepts)},
            {"id": "evidence", "label": "资料/练习/错因", "level": 4, "nodeCount": len(evidence)},
        ],
        "summary": {
            "subjectCount": len(subjects),
            "unitCount": len(units),
            "conceptCount": len(concepts),
            "edgeCount": len(edges),
            "documentCount": len(evidence),
            "visibleNodeCount": len(visible_nodes),
            "visibleEdgeCount": len(hierarchy_edges),
        },
        "nodesByLevel": {"subject": subjects, "unit": units, "concept": concepts, "evidence": evidence},
        "visibleGraph": {
            "course_id": graph.get("course_id") or "learning-companion-layered",
            "title": graph.get("title") or "学伴分层知识图谱",
            "version": graph.get("version") or "layered-v3",
            "nodes": visible_nodes,
            "edges": hierarchy_edges,
        },
        "navigation": {"defaultDepth": 2},
    }


def build_workspace(student_id: str, include_library: bool = True, include_memory: bool = True) -> dict[str, Any]:
    rpc("fs/mkdir", {"path": workspace_root()}, timeout=20.0)
    rpc("wiki/init", workspace_params(), timeout=20.0)
    status = rpc("wiki/status", workspace_params(), timeout=20.0)
    wiki_pages = rpc("wiki/listPages", workspace_params() | {"limit": 500}, timeout=20.0) if include_library else {"pages": []}
    wiki_tree = rpc("wiki/getTree", workspace_params() | {"depth": 6}, timeout=20.0) if include_library else {"tree": {"nodes": []}}
    wiki_assets = rpc("wiki/listAssets", workspace_params() | {"limit": 200}, timeout=20.0) if include_library else {"assets": []}
    graph = load_graph(student_id, status)
    node_states = load_node_states() if include_memory else {}
    memory = load_memory_pages(student_id) if include_memory else {}
    documents = load_documents(wiki_pages, include_library=include_library)
    hierarchy = graph_hierarchy(graph, documents, node_states)
    metrics = {"dimensions": {}, "evidence": []}
    payload = optional_page_payload(PATHS["evaluationMetrics"])
    if isinstance(payload, dict):
        metrics = payload
    updated_at = now_iso()
    growth_evidence = workspace_growth_evidence(metrics, documents, updated_at)
    growth_points = workspace_growth_points(documents, growth_evidence)
    response = {
        "studentId": student_id,
        "dataSource": "doagent",
        "workspaceRoot": workspace_root(),
        "paths": PATHS,
        "wikiStatus": status,
        "wikiPages": wiki_pages,
        "wikiTree": wiki_tree,
        "wikiAssets": wiki_assets,
        "graph": graph,
        "graphHierarchy": hierarchy,
        "nodeStates": node_states,
        "documents": documents,
        "growthMetrics": metrics,
        "memory": memory,
        "growthEvidence": growth_evidence,
        "growthPoints": growth_points,
        "actionCounts": workspace_action_counts(documents, growth_evidence),
        "updatedAt": updated_at,
        "errors": [],
    }
    if include_library and include_memory:
        return attach_persistent_workspace_quality_errors(response, student_id)
    response["qualityStatus"] = "deferred"
    return response


def graph_layer(snapshot: dict[str, Any], depth: int, focus_node_id: str | None, limit: int) -> dict[str, Any]:
    hierarchy = snapshot.get("graphHierarchy") if isinstance(snapshot.get("graphHierarchy"), dict) else {}
    nodes_by_level = hierarchy.get("nodesByLevel") if isinstance(hierarchy.get("nodesByLevel"), dict) else {}
    selected: list[dict[str, Any]] = []
    if depth >= 1:
        selected.extend(item for item in nodes_by_level.get("subject", []) if isinstance(item, dict))
    if depth >= 2:
        selected.extend(item for item in nodes_by_level.get("unit", []) if isinstance(item, dict))
    if depth >= 3:
        selected.extend(item for item in nodes_by_level.get("concept", []) if isinstance(item, dict))
    if depth >= 4:
        selected.extend(item for item in nodes_by_level.get("evidence", []) if isinstance(item, dict))
    if focus_node_id:
        all_nodes = [item for rows in nodes_by_level.values() if isinstance(rows, list) for item in rows if isinstance(item, dict)]
        selected.extend(item for item in all_nodes if str(item.get("id") or "") == focus_node_id or str(item.get("parentId") or "") == focus_node_id)
    deduped: dict[str, dict[str, Any]] = {}
    for node in selected:
        node_id = str(node.get("id") or "")
        if node_id:
            deduped.setdefault(node_id, node)
    nodes = list(deduped.values())[: max(1, min(500, limit))]
    node_ids = {str(node.get("id") or "") for node in nodes}
    visible_graph = hierarchy.get("visibleGraph") if isinstance(hierarchy.get("visibleGraph"), dict) else {}
    edges = [edge for edge in visible_graph.get("edges", []) if isinstance(edge, dict) and str(edge.get("source") or "") in node_ids and str(edge.get("target") or "") in node_ids]
    return {
        "version": hierarchy.get("version") or "learning-companion-kg-v3",
        "depth": depth,
        "focusNodeId": focus_node_id,
        "layers": hierarchy.get("layers") or [],
        "summary": hierarchy.get("summary") or {},
        "graph": {
            "course_id": visible_graph.get("course_id") or "learning-companion-layered",
            "title": visible_graph.get("title") or "学伴分层知识图谱",
            "version": visible_graph.get("version") or "layered-v3",
            "nodes": nodes,
            "edges": edges,
        },
    }


def latest_practice_session(snapshot: dict[str, Any]) -> dict[str, Any] | None:
    docs = [doc for doc in snapshot.get("documents", []) if isinstance(doc, dict) and isinstance(doc.get("practiceSession"), dict)]
    docs.sort(key=lambda item: str(item.get("updatedAt") or ""), reverse=True)
    return docs[0].get("practiceSession") if docs else None


def latest_practice_result(snapshot: dict[str, Any]) -> dict[str, Any] | None:
    docs = [doc for doc in snapshot.get("documents", []) if isinstance(doc, dict) and isinstance(doc.get("practiceResult"), dict)]
    docs.sort(key=lambda item: str(item.get("updatedAt") or ""), reverse=True)
    return docs[0].get("practiceResult") if docs else None


def practice_result_for_attempt(snapshot: dict[str, Any], session_id: str | None, attempt_id: str | None) -> dict[str, Any] | None:
    for doc in snapshot.get("documents", []):
        if not isinstance(doc, dict) or not isinstance(doc.get("practiceResult"), dict):
            continue
        result = doc["practiceResult"]
        if session_id and result.get("sessionId") != session_id:
            continue
        if attempt_id and result.get("attemptId") != attempt_id:
            continue
        return result
    return None


def practice_result_has_metric_evidence(snapshot: dict[str, Any], attempt_id: str) -> bool:
    metrics = snapshot.get("growthMetrics") if isinstance(snapshot.get("growthMetrics"), dict) else {}
    evidence = metrics.get("evidence") if isinstance(metrics.get("evidence"), list) else []
    for item in evidence:
        if not isinstance(item, dict):
            continue
        values = [
            item.get("id"),
            item.get("eventId"),
            item.get("attemptId"),
            item.get("resultPath"),
            item.get("summary"),
        ]
        if any(attempt_id in str(value or "") for value in values):
            linked = item.get("linkedNodeIds")
            return isinstance(linked, list) and bool(linked)
    return False


def _node_state_number(state: dict[str, Any], *keys: str, default: float = 0.0) -> float:
    for key in keys:
        value = state.get(key)
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value)
            except ValueError:
                continue
    return default


def _node_has_evidence(node_id: str, documents: list[dict[str, Any]]) -> bool:
    for document in documents:
        linked = document.get("linkedNodeIds")
        if isinstance(linked, list) and node_id in {str(item) for item in linked}:
            return True
        session = document.get("practiceSession")
        if isinstance(session, dict):
            for question in session.get("questions") or []:
                if isinstance(question, dict) and node_id in {str(item) for item in question.get("nodeIds") or []}:
                    return True
        result = document.get("practiceResult")
        if isinstance(result, dict) and node_id in {str(item) for item in result.get("linkedNodeIds") or []}:
            return True
    return False


def _candidate_learning_nodes(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    graph = snapshot.get("graph") if isinstance(snapshot.get("graph"), dict) else {}
    node_states = snapshot.get("nodeStates") if isinstance(snapshot.get("nodeStates"), dict) else {}
    documents = snapshot.get("documents") if isinstance(snapshot.get("documents"), list) else []
    candidates: list[dict[str, Any]] = []
    for node in graph.get("nodes") or []:
        if not isinstance(node, dict):
            continue
        node_id = str(node.get("id") or "").strip()
        if not node_id:
            continue
        node_type = str(node.get("type") or "").strip()
        if node_type not in L3_NODE_TYPES:
            continue
        state = node_states.get(node_id) if isinstance(node_states.get(node_id), dict) else {}
        mastery = _node_state_number(state, "mastery", default=15.0)
        review_priority = _node_state_number(state, "reviewPriority", "review_priority", default=0.0)
        mistake_count = _node_state_number(state, "mistakeCount", "mistake_count", default=0.0)
        evidence_bonus = 20 if _node_has_evidence(node_id, documents) else -40
        score = (100 - mastery) + review_priority + mistake_count * 10 + evidence_bonus
        candidates.append({
            "node": node,
            "state": state,
            "score": score,
            "hasEvidence": evidence_bonus > 0,
        })
    candidates.sort(key=lambda item: item["score"], reverse=True)
    return candidates


def build_learning_path_action(student_id: str, snapshot: dict[str, Any], source: str, message: str) -> dict[str, Any]:
    candidates = _candidate_learning_nodes(snapshot)
    evidence_backed = [item for item in candidates if item.get("hasEvidence")]
    if not evidence_backed:
        return {
            "intent": "recommend_learning_path",
            "action": "need_more_material",
            "status": "needs_ingestion",
            "message": "还没有足够的可学习知识点。先输入一段课堂笔记、知识总结或错题记录，我再为你安排下一步。",
            "payload": {
                "studentId": student_id,
                "source": source,
                "reason": "workspace 中缺少有资料证据支撑的 L3 知识点。",
                "stats": {
                    "nodes": len((snapshot.get("graph") or {}).get("nodes") or []),
                    "documents": len(snapshot.get("documents") or []),
                },
            },
            "artifacts": [],
            "errors": [],
        }
    selected = evidence_backed[0]
    node = selected["node"]
    state = selected["state"] if isinstance(selected.get("state"), dict) else {}
    node_id = str(node.get("id") or "")
    label = str(node.get("label") or node_id)
    mastery = _node_state_number(state, "mastery", default=15.0)
    review_priority = _node_state_number(state, "reviewPriority", "review_priority", default=0.0)
    mistake_count = _node_state_number(state, "mistakeCount", "mistake_count", default=0.0)
    plan_id = f"learn-{int(time.time())}-{hashlib.sha1((student_id + node_id + message).encode('utf-8')).hexdigest()[:8]}"
    reason_parts = [
        f"掌握度 {round(mastery)}%",
        f"复习优先级 {round(review_priority)}",
    ]
    if mistake_count:
        reason_parts.append(f"错题/薄弱记录 {round(mistake_count)} 次")
    reason_parts.append("已有资料证据可追问和出题")
    return {
        "intent": "recommend_learning_path",
        "action": "show_learning_plan",
        "status": "ready",
        "message": f"今天建议先学习「{label}」。",
        "payload": {
            "planId": plan_id,
            "studentId": student_id,
            "source": source,
            "primaryNode": {
                "id": node_id,
                "label": label,
                "type": str(node.get("type") or ""),
                "mastery": mastery,
                "reviewPriority": review_priority,
            },
            "reason": "；".join(reason_parts),
            "queue": [
                {
                    "stepId": "probe",
                    "type": "probe",
                    "action": "ask_one_question",
                    "nodeIds": [node_id],
                    "title": "先问一个诊断问题",
                    "instruction": "只围绕该薄弱点问一个问题，先不直接讲答案。",
                    "estimatedMinutes": 2,
                },
                {
                    "stepId": "review",
                    "type": "review",
                    "action": "show_review_task",
                    "nodeIds": [node_id],
                    "title": "复盘资料和错因",
                    "instruction": "根据 Wiki 和历史练习复盘关键条件、易错点和适用边界。",
                    "estimatedMinutes": 5,
                },
                {
                    "stepId": "practice",
                    "type": "practice",
                    "action": "show_practice_session",
                    "nodeIds": [node_id],
                    "title": "生成递进练习",
                    "instruction": "生成 3 道结构化练习，作答后更新掌握度和错题记录。",
                    "estimatedMinutes": 8,
                },
            ],
            "stats": {
                "candidateCount": len(candidates),
                "evidenceBackedCount": len(evidence_backed),
                "documents": len(snapshot.get("documents") or []),
            },
        },
        "artifacts": [],
        "errors": [],
    }


def persist_learning_path_action(action: dict[str, Any]) -> None:
    payload = action.get("payload") if isinstance(action.get("payload"), dict) else {}
    plan_id = str(payload.get("planId") or "").strip()
    if not plan_id or action.get("action") != "show_learning_plan":
        return
    rpc("wiki/savePage", workspace_params() | {
        "page": {
            "path": f"wiki/pages/learning-plans/{plan_id}.md",
            "title": f"学习计划 - {payload.get('primaryNode', {}).get('label') if isinstance(payload.get('primaryNode'), dict) else plan_id}",
            "topic": "learning-plan",
            "summary": str(action.get("message") or "学伴生成的下一步学习计划。"),
            "content": fenced_json_page(action),
        },
    }, timeout=30.0)


def result_linked_node_ids(result: dict[str, Any]) -> list[str]:
    ordered: list[str] = []

    def add_many(values: Any) -> None:
        if not isinstance(values, list):
            return
        for value in values:
            node_id = str(value or "").strip()
            if node_id and node_id not in ordered:
                ordered.append(node_id)

    add_many(result.get("wrongNodeIds"))
    for update in result.get("masteryUpdates") if isinstance(result.get("masteryUpdates"), list) else []:
        if isinstance(update, dict):
            add_many([update.get("nodeId")])
    for question in result.get("questionResults") if isinstance(result.get("questionResults"), list) else []:
        if isinstance(question, dict):
            add_many(question.get("linkedNodeIds") or question.get("nodeIds"))
    return ordered


def result_score_value(result: dict[str, Any]) -> float:
    raw = result.get("score")
    if isinstance(raw, (int, float)):
        return float(raw)
    if isinstance(raw, dict):
        value = raw.get("value")
        if isinstance(value, (int, float)):
            return float(value)
        correct = raw.get("correct")
        total = raw.get("total")
        if isinstance(correct, (int, float)) and isinstance(total, (int, float)) and total:
            return float(correct) / float(total)
    question_results = result.get("questionResults") if isinstance(result.get("questionResults"), list) else []
    if question_results:
        correct = sum(1 for item in question_results if isinstance(item, dict) and item.get("correct") is True)
        return correct / len(question_results)
    return 0.0


def is_valid_practice_score_value(value: Any) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(float(value))
        and 0 <= float(value) <= 1
    )


def practice_score_contract_error(item: dict[str, Any], field: str = "score") -> str | None:
    if not isinstance(item, dict):
        return None
    raw = item.get(field)
    if raw is None:
        return None
    if is_valid_practice_score_value(raw):
        return None
    attempt_id = str(item.get("attemptId") or item.get("id") or "<unknown-attempt>")
    return f"practice score must be between 0 and 1 for {attempt_id}"


def is_valid_practice_history_item(item: Any) -> bool:
    if not isinstance(item, dict):
        return False
    if not str(item.get("attemptId") or item.get("id") or "").strip():
        return False
    error = practice_score_contract_error(item)
    return error is None


def is_valid_practice_metric_row(item: Any) -> bool:
    if not isinstance(item, dict):
        return False
    is_practice_row = bool(item.get("attemptId")) or str(item.get("kind") or "").lower() == "practice_result" or str(item.get("id") or "").startswith("metric:practice-result:")
    if not is_practice_row:
        return True
    value_error = practice_score_contract_error(item, field="value")
    score_error = practice_score_contract_error(item, field="score")
    return value_error is None and score_error is None


def is_valid_practice_evidence_item(item: Any) -> bool:
    if not isinstance(item, dict):
        return False
    is_practice_item = bool(item.get("attemptId")) or str(item.get("kind") or "").lower() == "practice_result"
    if not is_practice_item:
        return True
    return practice_score_contract_error(item) is None


def ensure_practice_result_workspace_projection(student_id: str, session_id: str, attempt_id: str, result: dict[str, Any]) -> None:
    linked_node_ids = result_linked_node_ids(result)
    if not linked_node_ids:
        raise RuntimeError(f"practice result missing linked L3 node ids for attempt {attempt_id}")
    result_path = f"wiki/pages/practice-results/{attempt_id}.md"
    submitted_at = str(result.get("submittedAt") or now_iso())
    score_value = result_score_value(result)

    overlay = optional_page_payload(PATHS["studentOverlay"]) or {"studentId": student_id, "nodes": {}}
    overlay["studentId"] = overlay.get("studentId") or student_id
    nodes = overlay.get("nodes")
    if not isinstance(nodes, dict):
        nodes = {}
        overlay["nodes"] = nodes
    updates = result.get("masteryUpdates") if isinstance(result.get("masteryUpdates"), list) else []
    updates_by_node = {
        str(update.get("nodeId") or ""): update
        for update in updates
        if isinstance(update, dict) and str(update.get("nodeId") or "").strip()
    }
    wrong_node_ids = {str(item) for item in result.get("wrongNodeIds", []) if str(item or "").strip()} if isinstance(result.get("wrongNodeIds"), list) else set()
    for node_id in linked_node_ids:
        state = nodes.get(node_id) if isinstance(nodes.get(node_id), dict) else {}
        update = updates_by_node.get(node_id, {})
        mastery = update.get("newMastery")
        if not isinstance(mastery, (int, float)):
            mastery = update.get("updatedMastery")
        if not isinstance(mastery, (int, float)):
            mastery = update.get("to")
        if isinstance(mastery, (int, float)):
            state["mastery"] = mastery
        confidence = update.get("newConfidence")
        if not isinstance(confidence, (int, float)):
            confidence = update.get("updatedConfidence")
        if not isinstance(confidence, (int, float)):
            confidence = update.get("confidence")
        if isinstance(confidence, (int, float)):
            state["confidence"] = confidence
        if node_id in wrong_node_ids:
            state["status"] = "learning"
            state["mistakeCount"] = int(state.get("mistakeCount") or 0) + 1
            state["reviewPriority"] = max(float(state.get("reviewPriority") or 0), 80.0)
            weaknesses = state.get("observedWeaknesses") if isinstance(state.get("observedWeaknesses"), list) else []
            feedback = next(
                (
                    str(item.get("feedback") or "")
                    for item in result.get("questionResults", [])
                    if isinstance(item, dict) and item.get("correct") is False and node_id in [str(value) for value in (item.get("linkedNodeIds") or item.get("nodeIds") or [])]
                ),
                "",
            )
            if feedback and feedback not in weaknesses:
                weaknesses.append(feedback)
            state["observedWeaknesses"] = weaknesses[-8:]
        state["lastEvidence"] = result_path
        state["lastPracticeAttemptId"] = attempt_id
        state["lastTouchedAt"] = submitted_at
        state["updatedAt"] = submitted_at
        nodes[node_id] = state
    overlay["updatedAt"] = submitted_at
    overlay["lastUpdatedBy"] = f"practice_submit:{session_id}:{attempt_id}"
    save_json_page(PATHS["studentOverlay"], "AI 学伴 - 学生掌握状态", overlay, topic="graph", summary="练习提交后的学生掌握状态。")

    metrics = optional_page_payload(PATHS["evaluationMetrics"]) or {"studentId": student_id, "evidence": [], "metrics": []}
    metrics["studentId"] = metrics.get("studentId") or student_id
    evidence = metrics.get("evidence") if isinstance(metrics.get("evidence"), list) else []
    evidence = [
        item
        for item in evidence
        if isinstance(item, dict) and is_valid_practice_evidence_item(item) and item.get("attemptId") != attempt_id
    ]
    evidence.append({
        "id": f"ev:practice:{session_id}:{attempt_id}",
        "attemptId": attempt_id,
        "kind": "practice_result",
        "resultPath": result_path,
        "linkedNodeIds": linked_node_ids,
        "score": score_value,
        "summary": f"练习 {session_id} 已批改，attemptId={attempt_id}，得分 {score_value:.2f}。",
        "at": submitted_at,
    })
    metrics["evidence"] = evidence
    metric_rows = metrics.get("metrics") if isinstance(metrics.get("metrics"), list) else []
    metric_rows = [
        item
        for item in metric_rows
        if isinstance(item, dict) and is_valid_practice_metric_row(item) and item.get("attemptId") != attempt_id
    ]
    metric_rows.append({
        "id": f"metric:practice-result:{session_id}:{attempt_id}",
        "label": "练习提交得分",
        "value": score_value,
        "scale": "0-1",
        "sessionId": session_id,
        "attemptId": attempt_id,
        "linkedNodeIds": linked_node_ids,
    })
    metrics["metrics"] = metric_rows
    save_json_page(PATHS["evaluationMetrics"], "AI 学伴 - 学生成长评价指标", metrics, topic="evaluation", summary="练习提交后的成长评价证据。")

    profile = optional_page_payload(PATHS["memoryProfile"]) or {"studentId": student_id, "practiceHistory": []}
    profile["studentId"] = profile.get("studentId") or student_id
    history = profile.get("practiceHistory") if isinstance(profile.get("practiceHistory"), list) else []
    history = [
        item
        for item in history
        if isinstance(item, dict) and is_valid_practice_history_item(item) and item.get("attemptId") != attempt_id
    ]
    history.append({
        "sessionId": session_id,
        "attemptId": attempt_id,
        "score": score_value,
        "wrongNodeIds": sorted(wrong_node_ids),
        "resultPath": result_path,
        "at": submitted_at,
    })
    profile["practiceHistory"] = history[-50:]
    profile["lastUpdatedBy"] = f"practice_submit:{session_id}:{attempt_id}"
    save_json_page(PATHS["memoryProfile"], "AI 学伴 - 学习者画像", profile, topic="memory", summary="练习提交后的学习者画像。")

    reflections = optional_page_payload(PATHS["memoryReflections"]) or {"studentId": student_id, "reflections": []}
    reflections["studentId"] = reflections.get("studentId") or student_id
    reflection_rows = reflections.get("reflections") if isinstance(reflections.get("reflections"), list) else []
    reflection_rows = [
        item
        for item in reflection_rows
        if isinstance(item, dict) and is_valid_practice_history_item(item) and item.get("attemptId") != attempt_id
    ]
    reflection_rows.append({
        "id": f"reflection:practice:{session_id}:{attempt_id}",
        "type": "practice_submit",
        "sessionId": session_id,
        "attemptId": attempt_id,
        "score": score_value,
        "wrongNodeIds": sorted(wrong_node_ids),
        "linkedNodeIds": linked_node_ids,
        "evidence": result_path,
        "summary": f"练习提交已批改，得分 {score_value:.2f}。",
        "at": submitted_at,
    })
    reflections["reflections"] = reflection_rows[-50:]
    save_json_page(PATHS["memoryReflections"], "AI 学伴 - 学习反思", reflections, topic="memory", summary="练习提交后的学习反思。")

    tree = optional_page_payload(PATHS["memoryTree"])
    if isinstance(tree, dict):
        for item in tree.get("items") if isinstance(tree.get("items"), list) else []:
            if isinstance(item, dict) and str(item.get("nodeId") or "") in linked_node_ids:
                item["lastPracticeAttemptId"] = attempt_id
                item["lastEvidence"] = result_path
        save_json_page(PATHS["memoryTree"], "AI 学伴 - 记忆树", tree, topic="memory", summary="练习提交后的记忆树。")


def workspace_checkpoint(snapshot: dict[str, Any]) -> dict[str, int]:
    graph = snapshot.get("graph") if isinstance(snapshot.get("graph"), dict) else {}
    metrics = snapshot.get("growthMetrics") if isinstance(snapshot.get("growthMetrics"), dict) else {}
    metric_evidence = metrics.get("evidence") if isinstance(metrics.get("evidence"), list) else []
    growth_evidence = snapshot.get("growthEvidence") if isinstance(snapshot.get("growthEvidence"), list) else []
    evidence = growth_evidence or metric_evidence
    documents = snapshot.get("documents") if isinstance(snapshot.get("documents"), list) else []
    node_states = snapshot.get("nodeStates") if isinstance(snapshot.get("nodeStates"), dict) else {}
    memory = snapshot.get("memory") if isinstance(snapshot.get("memory"), dict) else {}
    signature_payload = {
        "graph": graph,
        "documents": [
            {
                "path": doc.get("path"),
                "linkedNodeIds": doc.get("linkedNodeIds"),
                "updatedAt": doc.get("updatedAt"),
            }
            for doc in documents
            if isinstance(doc, dict)
        ],
        "nodeStates": node_states,
        "evidence": evidence,
        "memory": memory,
    }
    return {
        "nodes": len(graph.get("nodes") or []),
        "edges": len(graph.get("edges") or []),
        "documents": len(documents),
        "nodeStates": len(node_states),
        "evidence": len(evidence),
        "signature": int(
            hashlib.sha256(json.dumps(signature_payload, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")).hexdigest()[:15],
            16,
        ),
    }


def public_workspace_checkpoint(checkpoint: dict[str, int] | None) -> dict[str, int]:
    return {
        key: int((checkpoint or {}).get(key, 0) or 0)
        for key in ("nodes", "edges", "documents", "nodeStates", "evidence")
    }


def workspace_has_persistent_delta(before: dict[str, int], snapshot: dict[str, Any]) -> bool:
    after = workspace_checkpoint(snapshot)
    if before.get("signature") and after.get("signature") != before.get("signature"):
        return True
    return any(after.get(key, 0) > before.get(key, 0) for key in ("nodes", "edges", "documents", "nodeStates", "evidence"))


L3_NODE_TYPES = {"concept", "procedure", "application", "misconception", "assessment_point"}
COURSE_GRAPH_NODE_TYPES = {"subject", "unit"} | L3_NODE_TYPES
COURSE_GRAPH_EDGE_TYPES = {
    "contains",
    "prerequisite",
    "explains",
    "applies_to",
    "contrasts_with",
    "misconception_of",
    "assessed_by",
    "remediates",
}


def collect_kp_ids(value: Any) -> set[str]:
    found: set[str] = set()
    if isinstance(value, str):
        if value.startswith("kp:"):
            found.add(value)
        return found
    if isinstance(value, list):
        for item in value:
            found.update(collect_kp_ids(item))
        return found
    if isinstance(value, dict):
        for item in value.values():
            found.update(collect_kp_ids(item))
    return found


def persistent_workspace_quality_error(snapshot: dict[str, Any]) -> str | None:
    graph = snapshot.get("graph") if isinstance(snapshot.get("graph"), dict) else {}
    nodes = [node for node in graph.get("nodes", []) if isinstance(node, dict)]
    edges = [edge for edge in graph.get("edges", []) if isinstance(edge, dict)]
    documents = [doc for doc in snapshot.get("documents", []) if isinstance(doc, dict)]
    metrics = snapshot.get("growthMetrics") if isinstance(snapshot.get("growthMetrics"), dict) else {}
    evidence = metrics.get("evidence") if isinstance(metrics.get("evidence"), list) else []
    node_states = snapshot.get("nodeStates") if isinstance(snapshot.get("nodeStates"), dict) else {}

    for node in nodes:
        node_type = str(node.get("type") or "").lower()
        if node_type not in COURSE_GRAPH_NODE_TYPES:
            node_id = str(node.get("id") or "<missing-id>")
            return f"persistent workspace is invalid: unsupported course_graph node type {node_type or '<empty>'} for {node_id}"
        node_id = str(node.get("id") or "").strip()
        if node_type == "subject" and node_id and not node_id.startswith("subject:"):
            return f"persistent workspace is invalid: L1 subject id must start with subject: for {node_id}"
        if node_type == "unit" and node_id and not node_id.startswith("unit:"):
            return f"persistent workspace is invalid: L2 unit id must start with unit: for {node_id}"
        if node_type in L3_NODE_TYPES and node_id and not node_id.startswith("kp:"):
            return f"persistent workspace is invalid: L3 node id must start with kp: for {node_id}"
    for edge in edges:
        edge_type = str(edge.get("type") or "").lower()
        if edge_type not in COURSE_GRAPH_EDGE_TYPES:
            source = str(edge.get("source") or "<missing-source>")
            target = str(edge.get("target") or "<missing-target>")
            return f"persistent workspace is invalid: unsupported course_graph edge type {edge_type or '<empty>'} for {source} -> {target}"

    subjects = {str(node.get("id") or "") for node in nodes if str(node.get("type") or "").lower() == "subject" and node.get("id")}
    units = {str(node.get("id") or "") for node in nodes if str(node.get("type") or "").lower() in {"unit", "chapter", "lesson"} and node.get("id")}
    concepts = {
        str(node.get("id") or ""): node
        for node in nodes
        if str(node.get("type") or "").lower() in L3_NODE_TYPES and node.get("id")
    }
    if not subjects and isinstance(graph.get("subject"), dict):
        return "persistent workspace is invalid: L1 subject and L2 unit must be inside graph.nodes, not graph.subject or graph.units"
    if not units and isinstance(graph.get("units"), list) and graph.get("units"):
        return "persistent workspace is invalid: L1 subject and L2 unit must be inside graph.nodes, not graph.subject or graph.units"
    if not subjects:
        return "persistent workspace is invalid: missing L1 subject node from course_graph.md"
    if not units:
        return "persistent workspace is invalid: missing L2 unit node from course_graph.md"
    if not concepts:
        return "persistent workspace is invalid: missing L3 knowledge point nodes from course_graph.md"

    contains_edges = [
        (str(edge.get("source") or ""), str(edge.get("target") or ""))
        for edge in edges
        if str(edge.get("type") or "").lower() == "contains"
    ]
    unit_has_subject = {
        unit_id: any(source in subjects and target == unit_id for source, target in contains_edges)
        for unit_id in units
    }
    for node in nodes:
        node_type = str(node.get("type") or "").lower()
        if node_type not in {"unit", "chapter", "lesson"}:
            continue
        subject_id = str(node.get("subjectId") or "")
        node_id = str(node.get("id") or "")
        if subject_id in subjects:
            unit_has_subject[node_id] = True
    if not any(unit_has_subject.values()):
        return "persistent workspace is invalid: L2 unit nodes are not connected to an L1 subject"

    for concept_id, node in concepts.items():
        unit_id = str(node.get("unitId") or node.get("parentId") or "")
        edge_unit_id = next((source for source, target in contains_edges if source in units and target == concept_id), "")
        parent_unit_id = unit_id if unit_id in units else edge_unit_id
        linked_to_unit = bool(parent_unit_id)
        subject_id = str(node.get("subjectId") or "")
        linked_to_subject = subject_id in subjects or bool(parent_unit_id and unit_has_subject.get(parent_unit_id))
        if not linked_to_unit or not linked_to_subject:
            return f"persistent workspace is invalid: L3 node {concept_id} is not connected to L1/L2 hierarchy"

    documented_paths_by_node: dict[str, set[str]] = {}
    for doc in documents:
        path = str(doc.get("path") or doc.get("id") or "").strip()
        for node_id in (doc.get("linkedNodeIds") if isinstance(doc.get("linkedNodeIds"), list) else []):
            documented_paths_by_node.setdefault(str(node_id), set()).add(path)
    doc_linked_ids = set(documented_paths_by_node)
    concept_ids = set(concepts)
    if not (doc_linked_ids & concept_ids):
        return "persistent workspace is invalid: Wiki notes are not linked to any real L3 knowledge point"

    metric_linked_ids = {
        str(node_id)
        for item in evidence
        if isinstance(item, dict)
        for node_id in (item.get("linkedNodeIds") if isinstance(item.get("linkedNodeIds"), list) else [])
    }
    unknown_state_ids = sorted(str(node_id) for node_id in node_states if str(node_id) and str(node_id) not in concept_ids)
    unknown_metric_ids = sorted(node_id for node_id in metric_linked_ids if node_id not in concept_ids)
    if unknown_state_ids or unknown_metric_ids:
        valid_ids = ", ".join(sorted(concept_ids))
        unknown_parts = []
        if unknown_state_ids:
            unknown_parts.append("student_overlay.md nodes: " + ", ".join(unknown_state_ids))
        if unknown_metric_ids:
            unknown_parts.append("metrics.md evidence: " + ", ".join(unknown_metric_ids))
        return (
            "persistent workspace is invalid: unknown L3 ids outside course_graph.md; "
            + "; ".join(unknown_parts)
            + f"; valid graph L3 ids: {valid_ids}"
        )
    if not (metric_linked_ids & concept_ids):
        return "persistent workspace is invalid: growth/evaluation evidence is not linked to any real L3 knowledge point"
    for item in evidence:
        if not isinstance(item, dict):
            continue
        score_error = practice_score_contract_error(item)
        if score_error:
            return f"persistent workspace is invalid: {score_error}"
    for item in metrics.get("metrics") if isinstance(metrics.get("metrics"), list) else []:
        if not isinstance(item, dict):
            continue
        if not is_valid_practice_metric_row(item):
            attempt_id = str(item.get("attemptId") or item.get("id") or "<unknown-attempt>")
            return f"persistent workspace is invalid: practice score must be between 0 and 1 for {attempt_id}"

    active_l3_ids = (set(node_states.keys()) | metric_linked_ids) & concept_ids
    for concept_id in sorted(active_l3_ids):
        declared_evidence = {
            str(item).strip()
            for item in (concepts[concept_id].get("evidence") if isinstance(concepts[concept_id].get("evidence"), list) else [])
            if str(item).strip()
        }
        documented_paths = documented_paths_by_node.get(concept_id, set())
        if declared_evidence and not (documented_paths & declared_evidence):
            return f"persistent workspace is invalid: L3 node {concept_id} is missing matching Wiki note evidence"
        if not declared_evidence and concept_id not in doc_linked_ids:
            return f"persistent workspace is invalid: L3 node {concept_id} is missing Wiki note evidence"

    if not (set(node_states.keys()) & concept_ids):
        return "persistent workspace is invalid: student_overlay.md has no state for real L3 knowledge points"
    memory = snapshot.get("memory") if isinstance(snapshot.get("memory"), dict) else {}
    required_memory_pages = {
        "memoryTree": PATHS["memoryTree"],
        "memoryProfile": PATHS["memoryProfile"],
        "memoryReflections": PATHS["memoryReflections"],
    }
    for key, path in required_memory_pages.items():
        if not isinstance(memory.get(key), dict):
            return f"persistent workspace is invalid: missing or invalid {path}"
    profile = memory.get("memoryProfile") if isinstance(memory.get("memoryProfile"), dict) else {}
    for item in profile.get("practiceHistory") if isinstance(profile.get("practiceHistory"), list) else []:
        if isinstance(item, dict) and not is_valid_practice_history_item(item):
            attempt_id = str(item.get("attemptId") or item.get("id") or "<unknown-attempt>")
            return f"persistent workspace is invalid: practice score must be between 0 and 1 for {attempt_id}"
    reflections = memory.get("memoryReflections") if isinstance(memory.get("memoryReflections"), dict) else {}
    for item in reflections.get("reflections") if isinstance(reflections.get("reflections"), list) else []:
        if isinstance(item, dict) and not is_valid_practice_history_item(item):
            attempt_id = str(item.get("attemptId") or item.get("id") or "<unknown-attempt>")
            return f"persistent workspace is invalid: practice score must be between 0 and 1 for {attempt_id}"
    unknown_memory_ids = sorted(node_id for node_id in collect_kp_ids(memory) if node_id not in concept_ids)
    if unknown_memory_ids:
        valid_ids = ", ".join(sorted(concept_ids))
        return (
            "persistent workspace is invalid: memory pages reference unknown L3 ids outside course_graph.md: "
            + ", ".join(unknown_memory_ids)
            + f"; valid graph L3 ids: {valid_ids}"
        )
    return None


def attach_workspace_quality_errors(snapshot: dict[str, Any]) -> dict[str, Any]:
    enriched = dict(snapshot)
    errors = list(enriched.get("errors") if isinstance(enriched.get("errors"), list) else [])
    quality_error = persistent_workspace_quality_error(enriched)
    if quality_error:
        errors.append({"code": "PERSISTENT_WORKSPACE_INVALID", "message": quality_error})
        enriched["qualityStatus"] = "invalid"
    else:
        enriched["qualityStatus"] = "valid"
    enriched["errors"] = errors
    return enriched


def workspace_quality_snapshot(student_id: str, graph: dict[str, Any]) -> dict[str, Any]:
    overlay = optional_page_payload(PATHS["studentOverlay"]) or {"nodes": {}}
    metrics = optional_page_payload(PATHS["evaluationMetrics"]) or {"evidence": [], "metrics": []}
    return {
        "graph": graph,
        "documents": load_repair_documents(),
        "growthMetrics": metrics if isinstance(metrics, dict) else {"evidence": [], "metrics": []},
        "nodeStates": overlay.get("nodes") if isinstance(overlay, dict) and isinstance(overlay.get("nodes"), dict) else {},
        "memory": load_memory_pages(student_id),
    }


def attach_persistent_workspace_quality_errors(snapshot: dict[str, Any], student_id: str) -> dict[str, Any]:
    enriched = dict(snapshot)
    errors = list(enriched.get("errors") if isinstance(enriched.get("errors"), list) else [])
    try:
        graph = enriched.get("graph") if isinstance(enriched.get("graph"), dict) else {}
        quality_error = persistent_workspace_quality_error(workspace_quality_snapshot(student_id, graph))
    except Exception as exc:
        quality_error = f"persistent workspace is invalid: {exc}"
    if quality_error:
        errors.append({"code": "PERSISTENT_WORKSPACE_INVALID", "message": quality_error})
        enriched["qualityStatus"] = "invalid"
    else:
        enriched["qualityStatus"] = "valid"
    enriched["errors"] = errors
    return enriched


def read_stable_persistent_workspace(
    student_id: str,
    baseline_checkpoint: dict[str, int],
    *,
    timeout_seconds: float = 45.0,
    poll_interval_seconds: float = 1.0,
) -> dict[str, Any]:
    deadline = time.time() + max(0.0, timeout_seconds)
    last_error: BaseException | None = None
    last_quality_error = ""
    while True:
        try:
            snapshot = build_workspace(student_id, include_library=True, include_memory=True)
            if workspace_has_persistent_delta(baseline_checkpoint, snapshot):
                quality_error = persistent_workspace_quality_error(snapshot)
                if quality_error is None:
                    return snapshot
                last_quality_error = quality_error
                last_error = RuntimeError(quality_error)
            else:
                last_error = RuntimeError("workspace has no persistent delta yet")
        except BaseException as exc:
            last_error = exc
        if time.time() >= deadline:
            break
        time.sleep(max(0.05, poll_interval_seconds))
    if last_quality_error:
        raise RuntimeError(last_quality_error)
    if last_error:
        raise RuntimeError(f"persistent workspace did not stabilize after doagent turn: {last_error}")
    raise RuntimeError("persistent workspace did not stabilize after doagent turn")


def persistent_workspace_repair_instruction(prompt: str, context: dict[str, Any], student_id: str, quality_error: str) -> str:
    intent = str(context.get("intent") or context.get("companionIntent") or "repair_persistent_workspace").strip()
    return (
        "修复 AI 学伴持久化 workspace。\n"
        f"上一轮已经产生结构化文件增量，但质量检查未通过：{quality_error}\n"
        "不要用占位内容绕过检查，不要创建普通 WikiIngest 页面，不要删除已有真实证据。\n"
        "The current working directory is already the workspace root. "
        "For every Read/Write/Edit/List tool call, file_path/path 必须使用相对路径；"
        "不要在 file_path/path 中写 workspaceRoot，也不要使用任何以 `/` 开头的绝对路径。\n"
        "必须先 Read 当前 course_graph.md、student_overlay.md、metrics.md 和相关 notes，再用 Edit/Write 修复缺口。\n"
        "修复目标：course_graph.md 的 L1/L2/L3 都在同一个 nodes 数组；"
        "student_overlay.md 的 nodes 必须覆盖真实 L3；"
        "metrics.md 顶层 evidence 必须包含 linkedNodeIds 并指向真实 L3；"
        "每个被评价的 L3 都要有 notes 证据。\n"
        "单次修复仍需遵守 compact persistence：结构化 Markdown 文件硬性控制在 4800 字节以内，目标 4500 字节以内；"
        "不要用 Append 分块写 graph/overlay/metrics/memory，超限就减少 L3、边、summary 和说明字段。\n"
        "ID registry rule: notes、course_graph.md、student_overlay.md、metrics.md 和 memory pages 必须复用完全相同的 L3 ids，"
        "不要重命名、翻译、缩短或重新生成 id。\n"
        "修复完成后 read back graph/student_overlay.md、evaluation/metrics.md、memory/*.md 和相关 notes，确认 JSON 可解析再结束。\n\n"
        f"studentId: {student_id}\n"
        f"intent: {intent or 'repair_persistent_workspace'}\n"
        f"学生输入：{prompt}"
    )


def workspace_update_event(snapshot: dict[str, Any]) -> dict[str, Any]:
    graph = snapshot.get("graph") if isinstance(snapshot.get("graph"), dict) else {}
    return {
        "type": "LEARNING_COMPANION_WORKSPACE_UPDATED",
        "result": {
            "workspaceRoot": snapshot.get("workspaceRoot"),
            "nodeCount": len(graph.get("nodes") or []),
            "edgeCount": len(graph.get("edges") or []),
            "documentCount": len(snapshot.get("documents") or []),
            "nodeStateCount": len(snapshot.get("nodeStates") or {}),
        },
    }


def sse(data: dict[str, Any]) -> bytes:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8")


def student_id_from_payload(payload: dict[str, Any]) -> str:
    context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
    value = payload.get("student_id") or payload.get("studentId") or context.get("student_id") or context.get("studentId")
    return str(value or DEFAULT_STUDENT_ID)


class Handler(BaseHTTPRequestHandler):
    def _body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        try:
            return json.loads(raw or "{}")
        except json.JSONDecodeError:
            return {}

    def _query(self) -> dict[str, list[str]]:
        return urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _ok(self, data: Any) -> None:
        self._json(200, {"code": 0, "message": "ok", "data": data})

    def _fail(self, status: int, message: str) -> None:
        self._json(status, {"code": status, "message": message})

    def do_GET(self) -> None:
        route = urllib.parse.urlparse(self.path).path
        query = self._query()
        student_id = (query.get("student_id") or query.get("studentId") or [DEFAULT_STUDENT_ID])[0] or DEFAULT_STUDENT_ID
        try:
            if route in {"/health", "/"}:
                self._json(200, {"status": "ok", "service": "learning-companion", "workspaceRoot": workspace_root()})
                return
            if route == "/manifest":
                self._ok({
                    "id": "learning-companion",
                    "name": "AI Learning Companion",
                    "interfaces": ["http", "acp"],
                    "routes": [
                        {"method": "GET", "path": "/workspace"},
                        {"method": "GET", "path": "/workspace/documents"},
                        {"method": "GET", "path": "/workspace/page"},
                        {"method": "GET", "path": "/graph/layers"},
                        {"method": "POST", "path": "/workspace/repair"},
                        {"method": "POST", "path": "/chat/run"},
                        {"method": "POST", "path": "/agent/intent"},
                        {"method": "POST", "path": "/practice/session/recommend"},
                        {"method": "POST", "path": "/practice/session/{session_id}/submit"},
                        {"method": "POST", "path": "/phone-session/complete"},
                    ],
                })
                return
            if route == "/workspace":
                self._ok(build_workspace(
                    student_id,
                    include_library=(query.get("include_library") or ["true"])[0] != "false",
                    include_memory=(query.get("include_memory") or ["true"])[0] != "false",
                ))
                return
            if route == "/workspace/documents":
                snapshot = build_workspace(student_id, include_library=True, include_memory=False)
                docs = snapshot.get("documents") if isinstance(snapshot.get("documents"), list) else []
                keyword = str((query.get("query") or [""])[0]).strip().lower()
                kind = str((query.get("kind") or [""])[0]).strip()
                if keyword:
                    docs = [doc for doc in docs if keyword in json.dumps(doc, ensure_ascii=False).lower()]
                if kind:
                    docs = [doc for doc in docs if str(doc.get("kind") or "") == kind]
                offset = int((query.get("offset") or ["0"])[0] or 0)
                limit = int((query.get("limit") or ["60"])[0] or 60)
                rows = docs[offset: offset + limit]
                self._ok({"studentId": student_id, "documents": rows, "total": len(docs), "offset": offset, "limit": limit, "hasMore": offset + limit < len(docs), "updatedAt": snapshot.get("updatedAt")})
                return
            if route == "/workspace/page":
                page_path = (query.get("path") or [""])[0]
                self._ok(get_page(page_path))
                return
            if route == "/graph/layers":
                snapshot = build_workspace(student_id, include_library=True, include_memory=False)
                depth = int((query.get("depth") or ["2"])[0] or 2)
                limit = int((query.get("limit") or ["160"])[0] or 160)
                focus = (query.get("focus_node_id") or [""])[0] or None
                self._ok(graph_layer(snapshot, depth, focus, limit))
                return
            self._fail(404, "not found")
        except Exception as exc:
            # An absent wiki page is a caller-visible miss; only genuine skill
            # failures may surface as 502, or callers retry the wrong error.
            self._fail(404 if missing_wiki_page(exc) else 502, str(exc))

    def do_POST(self) -> None:
        route = urllib.parse.urlparse(self.path).path
        payload = self._body()
        student_id = student_id_from_payload(payload)
        try:
            if route == "/workspace/repair":
                self._ok(repair_workspace_contract(student_id))
                return
            if route == "/phone-session/complete":
                session_id = f"phone-{int(time.time())}"
                content = "```json\n" + json.dumps({
                    "sessionId": session_id,
                    "studentId": student_id,
                    "startedAt": payload.get("started_at"),
                    "endedAt": payload.get("ended_at"),
                    "summary": payload.get("summary"),
                    "timeline": payload.get("timeline") or [],
                }, ensure_ascii=False, indent=2) + "\n```"
                rpc("wiki/savePage", workspace_params() | {"path": f"pages/phone-sessions/{session_id}.md", "title": "语音陪伴记录", "content": content}, timeout=30.0)
                self._ok({"sessionId": session_id, "persisted": True})
                return
            if route == "/agent/intent":
                self._agent_intent(payload, student_id)
                return
            if route == "/practice/session/recommend":
                target_node_ids = payload.get("target_node_ids") if isinstance(payload.get("target_node_ids"), list) else []
                cleaned_target_node_ids = [str(node_id) for node_id in target_node_ids if str(node_id or "").strip()]
                requested_session_id = practice_session_id(student_id, cleaned_target_node_ids)
                snapshot = build_workspace(student_id, include_library=True, include_memory=True)
                practice_context = build_practice_generation_context(
                    snapshot,
                    cleaned_target_node_ids,
                    payload.get("limit") or 3,
                )
                if not practice_context.get("targetNodes"):
                    self._fail(422, "no assessable L3 knowledge point is available for practice generation")
                    return
                prompt = practice_session_instruction(
                    student_id,
                    requested_session_id,
                    cleaned_target_node_ids,
                    payload.get("limit") or 3,
                    payload.get("question_types") or [],
                    payload.get("keyword"),
                    payload.get("difficulty"),
                    practice_context,
                )
                context = {"studentId": student_id, "intent": "practice_session", "sessionId": requested_session_id}
                if payload.get("async_generation"):
                    threading.Thread(target=run_chat_task, args=(prompt, context), daemon=True).start()
                    self._ok({
                        "sessionId": requested_session_id,
                        "summary": practice_generation_pending_summary(),
                        "generationRequired": True,
                        "source": "doagent",
                        "targetNodes": practice_context.get("targetNodes") or [],
                    })
                    return
                run_chat_task(prompt, context)
                snapshot = build_workspace(student_id, include_library=True, include_memory=True)
                session = latest_practice_session(snapshot)
                if not isinstance(session, dict) or session.get("sessionId") != requested_session_id:
                    self._fail(502, f"doagent did not write the requested practice session: {requested_session_id}")
                    return
                try:
                    session = normalize_practice_session_payload(session)
                except ValueError as exc:
                    self._fail(502, f"doagent wrote an invalid practice session schema: {exc}")
                    return
                if not session.get("questions"):
                    self._fail(502, "doagent did not write a valid practice session to wiki/pages/practice-sessions")
                    return
                self._ok({
                    "summary": practice_generation_ready_summary(session),
                    "generationRequired": False,
                    "source": session.get("source") or "doagent",
                    "session": session,
                    "questions": session.get("questions") or [],
                    "targetNodes": session.get("targetNodes") or [],
                })
                return
            match = re.match(r"^/practice/session/([^/]+)/submit$", route)
            if match:
                session_id = urllib.parse.unquote(match.group(1))
                answers = payload.get("answers") if isinstance(payload.get("answers"), list) else []
                active_practice_session = payload.get("active_practice_session")
                if active_practice_session is None:
                    active_practice_session = payload.get("activePracticeSession")
                session_payload = optional_page_payload(f"wiki/pages/practice-sessions/{session_id}.md")
                if not isinstance(session_payload, dict):
                    self._fail(422, f"practice session is missing or invalid: {session_id}")
                    return
                try:
                    validate_practice_submit_contract(session_id, session_payload, answers, active_practice_session)
                except ValueError as exc:
                    self._fail(422, f"practice submit contract mismatch: {exc}")
                    return
                attempt_id = practice_attempt_id(session_id)
                result = grade_practice_session_locally(student_id, session_payload, attempt_id, answers)
                result = persist_practice_result(student_id, session_id, attempt_id, result)
                ensure_practice_result_workspace_projection(student_id, session_id, attempt_id, result)
                snapshot = build_workspace(student_id, include_library=True, include_memory=True)
                result = practice_result_for_attempt(snapshot, session_id, attempt_id)
                if not isinstance(result, dict):
                    self._fail(502, "worker did not persist practice result to wiki/pages/practice-results")
                    return
                if not practice_result_has_metric_evidence(snapshot, attempt_id):
                    self._fail(502, "worker did not project practice result into overlay, metrics, and memory")
                    return
                self._ok({
                    "summary": practice_result_summary(result),
                    "nextAction": practice_result_next_action(result),
                    "practiceResult": result,
                    "session": {"practiceResult": result},
                })
                return
            if route == "/chat/run":
                self._chat_run(payload, student_id)
                return
            self._fail(404, "not found")
        except Exception as exc:
            self._fail(502, str(exc))

    def _agent_intent(self, payload: dict[str, Any], student_id: str) -> None:
        intent = str(payload.get("intent") or "").strip()
        source = str(payload.get("source") or "frontend").strip() or "frontend"
        message = str(payload.get("message") or "").strip()
        if intent != "recommend_learning_path":
            self._fail(400, f"unsupported learning companion intent: {intent or 'empty'}")
            return
        snapshot = build_workspace(student_id, include_library=True, include_memory=True)
        action = build_learning_path_action(student_id, snapshot, source, message)
        try:
            persist_learning_path_action(action)
        except Exception as exc:
            self._fail(502, f"failed to persist learning path action: {exc}")
            return
        self._ok(action)

    def _chat_run(self, payload: dict[str, Any], student_id: str) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        client_run_id = str(payload.get("runId") or payload.get("threadId") or uuid4().hex)
        session_id = f"lc-chat-{uuid4().hex}"
        messages = payload.get("messages") if isinstance(payload.get("messages"), list) else []
        latest = next((item for item in reversed(messages) if isinstance(item, dict) and item.get("role") == "user"), {})
        prompt = extract_message_text(latest.get("content"))
        context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
        companion_intent = normalize_companion_intent(context.get("companionIntent") or context.get("intent"))
        self.wfile.write(sse({"type": "TEXT_MESSAGE_START", "runId": client_run_id}))
        self.wfile.flush()
        try:
            is_weakness_probe = companion_intent == "probe_weakness" or looks_like_weakness_probe_request(prompt)
            persistent_task = should_run_persistent_learning_task(prompt, companion_intent, is_weakness_probe)
            baseline_checkpoint = workspace_checkpoint(build_workspace(student_id, include_library=True, include_memory=True)) if persistent_task else None
            cwd = workspace_root() if persistent_task else dialogue_workspace_root()
            if persistent_task:
                ensure_runtime_skill_registered()
            rpc("session/new", {"sessionId": session_id, "cwd": cwd}, timeout=20.0)
            chat_prompt: list[dict[str, str]]
            if persistent_task:
                chat_prompt = [
                    {"type": "text", "text": persistent_learning_instruction(prompt, context, student_id)},
                    {"type": "text", "text": "\n\n[learning-companion-context]\n" + json.dumps(doagent_safe_context(context, {"studentId": student_id}), ensure_ascii=False)},
                ]
            else:
                chat_prompt = [
                    {"type": "text", "text": conversation_instruction(prompt, context)},
                    {"type": "text", "text": "\n\n[learning-companion-dialogue-context]\n" + json.dumps({
                        "studentId": student_id,
                        "intent": dialogue_context_intent(context, prompt),
                        "workspaceSummary": safe_workspace_dialogue_summary(student_id),
                        "activePracticeSession": active_practice_context(context),
                    }, ensure_ascii=False)},
                ]
            send_errors: list[BaseException] = []
            send_payload = {
                "chatId": session_id,
                "cwd": cwd,
                "prompt": chat_prompt,
                "completionReview": False,
                "artifactRequired": False,
            }
            threading.Thread(target=lambda: _capture_doagent_send(send_payload, send_errors, timeout=180.0), daemon=True).start()
            time.sleep(0.2)
            if send_errors:
                raise send_errors[0]
            if persistent_task:
                finish_reason, observed_snapshot = stream_doagent_events(
                    session_id,
                    self.wfile,
                    student_id=student_id,
                    baseline_checkpoint=public_workspace_checkpoint(baseline_checkpoint),
                    timeout_seconds=PERSISTENT_TURN_TIMEOUT_SECONDS,
                    result_cwd=cwd,
                )
            else:
                finish_reason, observed_snapshot = stream_doagent_events(session_id, self.wfile, result_cwd=cwd)
            if send_errors and finish_reason not in {"workspace_updated", "turn_finished", "stream_closed"}:
                raise send_errors[0]
            if persistent_task:
                if (
                    finish_reason == "workspace_updated"
                    and observed_snapshot is not None
                    and workspace_has_persistent_delta(baseline_checkpoint or {}, observed_snapshot)
                    and persistent_workspace_quality_error(observed_snapshot) is None
                ):
                    snapshot = observed_snapshot
                else:
                    observed_quality_error = ""
                    if (
                        observed_snapshot is not None
                        and workspace_has_persistent_delta(baseline_checkpoint or {}, observed_snapshot)
                    ):
                        observed_quality_error = persistent_workspace_quality_error(observed_snapshot) or ""
                    if observed_quality_error:
                        repair_session_id = f"{session_id}-repair"
                        repair_prompt = [
                            {
                                "type": "text",
                                "text": persistent_workspace_repair_instruction(
                                    prompt,
                                    context,
                                    student_id,
                                    observed_quality_error,
                                ),
                            },
                            {
                                "type": "text",
                                "text": "\n\n[learning-companion-repair-context]\n" + json.dumps(
                                    doagent_safe_context(context, {"studentId": student_id, "qualityError": observed_quality_error}),
                                    ensure_ascii=False,
                                ),
                            },
                        ]
                        rpc("session/new", {"sessionId": repair_session_id, "cwd": cwd}, timeout=20.0)
                        repair_send_errors: list[BaseException] = []
                        threading.Thread(target=lambda: _capture_doagent_send({
                            "chatId": repair_session_id,
                            "cwd": cwd,
                            "prompt": repair_prompt,
                            "completionReview": False,
                            "artifactRequired": False,
                        }, repair_send_errors, timeout=180.0), daemon=True).start()
                        time.sleep(0.2)
                        if repair_send_errors:
                            raise repair_send_errors[0]
                        finish_reason, observed_snapshot = stream_doagent_events(
                            repair_session_id,
                            self.wfile,
                            student_id=student_id,
                            baseline_checkpoint=public_workspace_checkpoint(baseline_checkpoint),
                            timeout_seconds=PERSISTENT_TURN_TIMEOUT_SECONDS,
                            result_cwd=cwd,
                        )
                        if repair_send_errors and finish_reason not in {"workspace_updated", "turn_finished", "stream_closed"}:
                            raise repair_send_errors[0]
                        if (
                            finish_reason == "workspace_updated"
                            and observed_snapshot is not None
                            and workspace_has_persistent_delta(baseline_checkpoint or {}, observed_snapshot)
                            and persistent_workspace_quality_error(observed_snapshot) is None
                        ):
                            snapshot = observed_snapshot
                        else:
                            try:
                                snapshot = read_stable_persistent_workspace(
                                    student_id,
                                    baseline_checkpoint or {},
                                    timeout_seconds=PERSISTENT_STABILIZE_TIMEOUT_SECONDS,
                                )
                            except RuntimeError as exc:
                                raise RuntimeError(f"persistent workspace repair failed: {observed_quality_error}; {exc}") from exc
                    else:
                        try:
                            snapshot = read_stable_persistent_workspace(
                                student_id,
                                baseline_checkpoint or {},
                                timeout_seconds=PERSISTENT_STABILIZE_TIMEOUT_SECONDS,
                            )
                        except RuntimeError as exc:
                            raise RuntimeError(f"doagent turn ended without stable persistent workspace changes: {finish_reason}; {exc}") from exc
                self.wfile.write(sse(workspace_update_event(snapshot)))
                session = latest_practice_session(snapshot)
                if session:
                    self.wfile.write(sse({"type": "LEARNING_COMPANION_PRACTICE_SESSION_READY", "session": session}))
            elif finish_reason in {"stream_closed", "turn_finished"}:
                final_text = doagent_result_final_text(cwd, session_id)
                if final_text:
                    self.wfile.write(sse({"type": "TEXT_MESSAGE_CONTENT", "delta": final_text}))
                else:
                    raise RuntimeError(f"doagent dialogue turn ended without final text: {finish_reason}")
            self.wfile.write(sse({"type": "RUN_FINISHED", "result": {"status": "Success"}}))
        except Exception as exc:
            self.wfile.write(sse({"type": "RUN_ERROR", "message": str(exc)}))
        self.wfile.flush()

    def log_message(self, format: str, *args) -> None:
        return


def extract_message_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(extract_message_text(item.get("text") if isinstance(item, dict) else item) for item in content)
    if isinstance(content, dict):
        return extract_message_text(content.get("text") or content.get("content") or "")
    return ""


def run_chat_task(prompt: str, context: dict[str, Any]) -> None:
    session_id = "lc-" + uuid4().hex
    ensure_runtime_skill_registered()
    rpc("session/new", {"sessionId": session_id, "cwd": workspace_root()}, timeout=20.0)
    intent = str(context.get("intent") or context.get("companionIntent") or "").strip()
    practice_intent = intent in {"practice_session", "practice_submit"}
    wait_errors: list[BaseException] = []
    wait_thread: threading.Thread | None = None
    if not practice_intent:
        wait_thread = threading.Thread(
            target=lambda: _capture_wait_for_doagent_turn(session_id, wait_errors),
            daemon=True,
        )
        wait_thread.start()
    time.sleep(0.2)
    if practice_intent:
        task_instruction = prompt
    else:
        task_instruction = persistent_learning_instruction(prompt, context, str(context.get("studentId") or DEFAULT_STUDENT_ID))
    send_payload = {
        "chatId": session_id,
        "cwd": workspace_root(),
        "prompt": [
            {"type": "text", "text": task_instruction},
            {"type": "text", "text": "\n\n[learning-companion-context]\n" + json.dumps(doagent_safe_context(context), ensure_ascii=False)},
        ],
        "completionReview": False,
        "artifactRequired": False,
    }
    send_errors: list[BaseException] = []
    if practice_intent:
        send_thread = threading.Thread(
            target=lambda: _capture_doagent_send(send_payload, send_errors, timeout=max(180.0, float(PRACTICE_TURN_TIMEOUT_SECONDS))),
            daemon=True,
        )
        send_thread.start()
    else:
        try:
            send_doagent_chat_message(send_payload, timeout=180.0)
        except Exception as exc:
            if not is_send_ack_read_timeout(exc):
                raise
    if practice_intent:
        if wait_for_practice_workspace_completion(
            str(context.get("studentId") or DEFAULT_STUDENT_ID),
            intent,
            str(context.get("sessionId") or "") or None,
            str(context.get("attemptId") or "") or None,
            timeout_seconds=float(PRACTICE_TURN_TIMEOUT_SECONDS),
        ):
            contract_error = practice_session_tool_contract_error_for_intent(session_id, intent)
            if contract_error:
                raise RuntimeError(contract_error)
            try:
                rpc("session/cancel", {"sessionId": session_id}, timeout=10.0)
            except Exception:
                pass
            return
        send_errors[:] = [error for error in send_errors if not is_send_ack_read_timeout(error)]
        if send_errors:
            raise send_errors[0]
        raise TimeoutError(f"{intent} did not produce complete workspace updates within {PRACTICE_TURN_TIMEOUT_SECONDS}s")
    if wait_thread is None:
        wait_for_doagent_turn(session_id)
        return
    wait_thread.join(timeout=245.0)
    if wait_thread.is_alive():
        raise TimeoutError("doagent turn did not finish within 240s")
    wait_errors[:] = [error for error in wait_errors if not is_send_ack_read_timeout(error)]
    if wait_errors:
        raise wait_errors[0]


def wait_for_practice_workspace_completion(
    student_id: str,
    intent: str,
    session_id: str | None,
    attempt_id: str | None = None,
    timeout_seconds: float = 240.0,
) -> bool:
    deadline = time.time() + max(1.0, timeout_seconds)
    while time.time() < deadline:
        try:
            snapshot = build_workspace(student_id, include_library=True, include_memory=True)
            if intent == "practice_session":
                for document in snapshot.get("documents", []):
                    if not isinstance(document, dict) or document.get("kind") != "practice_session_invalid":
                        continue
                    path = str(document.get("path") or "")
                    if session_id and f"/{session_id}.md" not in path:
                        continue
                    invalid = document.get("practiceSessionInvalid") if isinstance(document.get("practiceSessionInvalid"), dict) else {}
                    raise ValueError(str(invalid.get("reason") or "invalid practice session schema"))
                session = latest_practice_session(snapshot)
                if (
                    isinstance(session, dict)
                    and session.get("sessionId")
                    and session.get("questions")
                    and (not session_id or session.get("sessionId") == session_id)
                ):
                    return True
            if intent == "practice_submit":
                for document in snapshot.get("documents", []):
                    if not isinstance(document, dict) or document.get("kind") != "practice_result_invalid":
                        continue
                    path = str(document.get("path") or "")
                    if attempt_id and f"/{attempt_id}.md" not in path:
                        continue
                    invalid = document.get("practiceResultInvalid") if isinstance(document.get("practiceResultInvalid"), dict) else {}
                    raise ValueError(str(invalid.get("reason") or "invalid practice result schema"))
                result = practice_result_for_attempt(snapshot, session_id, attempt_id)
                if not isinstance(result, dict):
                    time.sleep(1.0)
                    continue
                if result.get("questionResults") or result.get("wrongNodeIds") is not None:
                    return bool(attempt_id)
        except ValueError:
            raise
        except Exception:
            pass
        time.sleep(1.0)
    return False


def _capture_wait_for_doagent_turn(session_id: str, errors: list[BaseException]) -> None:
    try:
        wait_for_doagent_turn(session_id)
    except BaseException as exc:
        errors.append(exc)


def _capture_rpc_call(method: str, params: dict[str, Any], errors: list[BaseException], timeout: float = 180.0) -> None:
    try:
        rpc(method, params, timeout=timeout)
    except BaseException as exc:
        errors.append(exc)


def _capture_doagent_send(params: dict[str, Any], errors: list[BaseException], timeout: float = 180.0) -> None:
    try:
        send_doagent_chat_message(params, timeout=timeout)
    except BaseException as exc:
        errors.append(exc)


def practice_session_tool_contract_error_for_intent(session_id: str, intent: str | None = None) -> str | None:
    try:
        return practice_session_tool_contract_error(session_id, intent)
    except TypeError:
        return practice_session_tool_contract_error(session_id)


def wait_for_doagent_turn(session_id: str, timeout_seconds: int = 240) -> None:
    url = f"{DOAGENT_BASE_URL}/events?{urllib.parse.urlencode({'sid': session_id})}"
    deadline = time.time() + max(1, timeout_seconds)
    last_error = ""
    read_timeout = min(5.0, max(1.0, timeout_seconds / 60))
    while time.time() < deadline:
        req = urllib.request.Request(url, method="GET")
        buffer: list[str] = []
        try:
            with urllib.request.urlopen(req, timeout=read_timeout) as resp:
                while time.time() < deadline:
                    try:
                        raw = resp.readline()
                    except BaseException as exc:
                        if is_transient_read_timeout(exc):
                            if doagent_result_payload(workspace_root(), session_id):
                                return
                            if response_object_is_unreadable_after_timeout(exc):
                                break
                            time.sleep(0.1)
                            continue
                        raise
                    if doagent_result_payload(workspace_root(), session_id):
                        return
                    if not raw:
                        break
                    line = raw.decode("utf-8", errors="ignore").strip()
                    if not line:
                        if not buffer:
                            continue
                        event = normalize_doagent_event("\n".join(buffer))
                        buffer = []
                        if not event:
                            continue
                        if event.get("type") == "DOAGENT_TURN_FINISHED":
                            return
                        if event.get("type") == "DOAGENT_TOOL_CALL" and event.get("status") == "failed":
                            last_error = extract_message_text(event.get("raw") or event)
                        continue
                    if line.startswith("data:"):
                        buffer.append(line[5:].strip())
        except BaseException as exc:
            if not is_transient_read_timeout(exc):
                raise
        if doagent_result_payload(workspace_root(), session_id):
            return
        time.sleep(0.1)
    raise TimeoutError(last_error or f"doagent turn did not finish within {timeout_seconds}s")


def stream_doagent_events(
    session_id: str,
    writer: Any,
    student_id: str | None = None,
    baseline_checkpoint: dict[str, int] | None = None,
    poll_interval_seconds: float = 5.0,
    timeout_seconds: int = 240,
    result_cwd: str | None = None,
) -> tuple[str, dict[str, Any] | None]:
    url = f"{DOAGENT_BASE_URL}/events?{urllib.parse.urlencode({'sid': session_id})}"
    deadline = time.time() + max(1, timeout_seconds)
    next_poll = time.time() + max(0.05, poll_interval_seconds)
    observed_snapshot: dict[str, Any] | None = None
    read_timeout = max(1.0, poll_interval_seconds)
    def poll_workspace_if_due(force: bool = False) -> tuple[bool, dict[str, Any] | None]:
        nonlocal next_poll, observed_snapshot
        if not student_id or baseline_checkpoint is None:
            return False, None
        if not force and time.time() < next_poll:
            return False, None
        try:
            snapshot = build_workspace(student_id, include_library=True, include_memory=True)
            observed_snapshot = snapshot
            if workspace_has_persistent_delta(baseline_checkpoint, snapshot) and persistent_workspace_quality_error(snapshot) is None:
                return True, snapshot
        except Exception:
            pass
        next_poll = time.time() + max(0.05, poll_interval_seconds)
        return False, None

    while time.time() < deadline:
        req = urllib.request.Request(url, method="GET")
        buffer: list[str] = []
        try:
            with urllib.request.urlopen(req, timeout=read_timeout) as resp:
                ready, snapshot = poll_workspace_if_due(force=True)
                if ready:
                    return "workspace_updated", snapshot
                while time.time() < deadline:
                    try:
                        raw = resp.readline()
                    except BaseException as exc:
                        if is_transient_read_timeout(exc):
                            ready, snapshot = poll_workspace_if_due()
                            if ready:
                                return "workspace_updated", snapshot
                            if result_cwd and doagent_result_exists(result_cwd, session_id):
                                error_message = doagent_result_error_message(result_cwd, session_id)
                                if error_message:
                                    raise RuntimeError(error_message)
                                return "turn_finished", observed_snapshot
                            if response_object_is_unreadable_after_timeout(exc):
                                break
                            time.sleep(min(0.2, max(0.05, poll_interval_seconds / 10)))
                            continue
                        raise
                    ready, snapshot = poll_workspace_if_due()
                    if ready:
                        return "workspace_updated", snapshot
                    if result_cwd and doagent_result_exists(result_cwd, session_id):
                        error_message = doagent_result_error_message(result_cwd, session_id)
                        if error_message:
                            raise RuntimeError(error_message)
                        return "turn_finished", observed_snapshot
                    if not raw:
                        break
                    line = raw.decode("utf-8", errors="ignore").strip()
                    if not line:
                        if buffer:
                            event = normalize_doagent_event("\n".join(buffer))
                            buffer = []
                            if event:
                                writer.write(sse(event))
                                writer.flush()
                                if event.get("type") == "DOAGENT_TURN_FINISHED":
                                    return "turn_finished", observed_snapshot
                                if event.get("type") == "DOAGENT_TOOL_CALL" and event.get("status") == "failed":
                                    raise RuntimeError(extract_message_text(event.get("raw") or event) or "doagent tool call failed")
                        continue
                    if line.startswith("data:"):
                        buffer.append(line[5:].strip())
                    ready, snapshot = poll_workspace_if_due()
                    if ready:
                        return "workspace_updated", snapshot
                    if result_cwd and doagent_result_exists(result_cwd, session_id):
                        error_message = doagent_result_error_message(result_cwd, session_id)
                        if error_message:
                            raise RuntimeError(error_message)
                        return "turn_finished", observed_snapshot
        except BaseException as exc:
            if not is_transient_read_timeout(exc):
                raise
        ready, snapshot = poll_workspace_if_due()
        if ready:
            return "workspace_updated", snapshot
        if result_cwd and doagent_result_exists(result_cwd, session_id):
            error_message = doagent_result_error_message(result_cwd, session_id)
            if error_message:
                raise RuntimeError(error_message)
            return "turn_finished", observed_snapshot
        time.sleep(min(0.2, max(0.05, poll_interval_seconds / 10)))
    final_poll_deadline = min(deadline, time.time() + max(1.0, min(15.0, poll_interval_seconds * 3)))
    attempts = 0
    while attempts < 3 or time.time() < final_poll_deadline:
        attempts += 1
        ready, snapshot = poll_workspace_if_due(force=True)
        if ready:
            return "workspace_updated", snapshot
        if result_cwd and doagent_result_exists(result_cwd, session_id):
            error_message = doagent_result_error_message(result_cwd, session_id)
            if error_message:
                raise RuntimeError(error_message)
            return "turn_finished", observed_snapshot
        if observed_snapshot is None:
            break
        time.sleep(min(0.5, max(0.05, poll_interval_seconds / 10)))
    return "stream_closed", observed_snapshot


def normalize_doagent_event(raw: str) -> dict[str, Any] | None:
    if not raw or raw == "ping":
        return None
    try:
        message = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if message.get("method") != "session/update":
        return None
    update = ((message.get("params") or {}).get("update") or {})
    kind = update.get("sessionUpdate")
    if kind == "agent_message_chunk":
        return {"type": "TEXT_MESSAGE_CONTENT", "delta": extract_message_text(update.get("content"))}
    if kind == "tool_call_update":
        return {
            "type": "DOAGENT_TOOL_CALL",
            "stepId": str(update.get("toolCallId") or update.get("toolName") or "tool"),
            "label": str(update.get("title") or update.get("toolName") or "tool"),
            "detail": extract_message_text(update.get("content") or update.get("input") or ""),
            "status": "completed" if update.get("status") == "completed" else "running",
            "toolName": update.get("toolName"),
            "raw": update,
        }
    if kind == "turn_finished":
        return {"type": "DOAGENT_TURN_FINISHED", "status": "completed", "raw": update}
    return None


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", LEARNING_COMPANION_PORT), Handler).serve_forever()
