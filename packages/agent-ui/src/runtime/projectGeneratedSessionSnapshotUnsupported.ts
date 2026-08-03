import type { UnsupportedValue } from "@agent-cloud/proto/agent_workbench/v2/content_pb";

import type {
  AgentTimelineItem,
  AgentToolActivityItem,
  AgentToolStatus,
} from "../contracts";
import { resolveSourceTool } from "../protocol/sourceToolCatalog";
import {
  decodeStructuredPayload,
  formatUnsupported,
} from "./projectGeneratedSessionSnapshotPayload";
import { unsupportedTimeline } from "./projectGeneratedSessionSnapshotTimelineHelpers";

export function projectUnsupportedTimeline(
  id: string,
  value: UnsupportedValue,
): AgentTimelineItem[] {
  const recovered = recoverUnknownTool(id, value);
  if (recovered) return [recovered];
  return [unsupportedTimeline(id, formatUnsupported(value))];
}

function recoverUnknownTool(
  id: string,
  value: UnsupportedValue,
): AgentToolActivityItem | null {
  const semanticKey = value.identity?.semanticKey ?? "";
  if (semanticKey !== "tool.unknown" && semanticKey !== "tool.phase") {
    return null;
  }
  const decoded = decodeStructuredPayload(value.payload);
  if (!decoded) return null;
  const record = asRecord(decoded.value) ?? parseJsonRecord(decoded.text);
  if (!record) return null;
  const toolName =
    typeof record.toolName === "string" && record.toolName.trim()
      ? record.toolName.trim()
      : "Tool";
  const identity = resolveRecoveredToolIdentity(
    value.identity?.namespace,
    toolName,
    value.identity?.schemaVersion,
  );
  const status = projectRecoveredToolStatus(record);
  const detailParts = [
    typeof record.resultText === "string" ? record.resultText : "",
    typeof record.errorMessage === "string" ? record.errorMessage : "",
  ].filter(Boolean);
  const args =
    typeof record.argumentsJson === "string" ? record.argumentsJson.trim() : "";
  return {
    id,
    kind: "tool",
    identity,
    title: toolName,
    detail: detailParts.join("\n") || undefined,
    input: args && args !== "{}" ? args : undefined,
    inputValue: args ? parseJSONValue(args) : undefined,
    results: [],
    status,
  };
}

function resolveRecoveredToolIdentity(
  namespace: string | undefined,
  toolName: string,
  schemaVersion: string | undefined,
) {
  const protocol = namespace?.replace(/^agentcloud\./, "") || "acp";
  const baseName = toolName.split(/\s+/, 1)[0] || toolName;
  const resolved =
    resolveSourceTool(protocol, baseName) ||
    resolveSourceTool("acp", baseName) ||
    resolveSourceTool("claude", baseName) ||
    resolveSourceTool("codex", baseName);
  if (resolved) {
    return {
      namespace: resolved.namespace || namespace || "agentcloud.acp",
      semanticKey: resolved.semanticKey,
      schemaVersion: resolved.schemaVersion || schemaVersion || "1",
    };
  }
  return {
    namespace: namespace || "agentcloud.acp",
    semanticKey: "tool.custom",
    schemaVersion: schemaVersion || "1",
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseJsonRecord(text: string): Record<string, unknown> | null {
  try {
    return asRecord(JSON.parse(text));
  } catch {
    return null;
  }
}

function parseJSONValue(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function projectRecoveredToolStatus(
  record: Record<string, unknown>,
): AgentToolStatus {
  if (record.success === false) return "failed";
  if (record.success === true) return "completed";
  const status = typeof record.status === "string" ? record.status : "";
  if (status === "failed" || status === "cancelled") return "failed";
  if (status === "completed") return "completed";
  if (status === "in_progress" || status === "running" || status === "pending") {
    return "running";
  }
  return "completed";
}
