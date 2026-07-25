import {
  parseOmnigentMessageContent,
} from "./omnigentMessageContent";
import type {
  OmnigentStreamEvent,
  OmnigentTurnRef,
} from "./omnigentStreamEvents";

type Wire = Record<string, unknown>;

const TURN_LIFECYCLE: Record<string, OmnigentStreamEvent["type"]> = {
  "turn.started": "turn_started",
  "turn.completed": "turn_completed",
  "response.failed": "turn_failed",
  "response.cancelled": "turn_cancelled",
};

export function parseOmnigentEvent(
  eventName: string,
  data: Wire,
): OmnigentStreamEvent | null {
  const lifecycle = TURN_LIFECYCLE[eventName];
  if (lifecycle !== undefined) {
    return { type: lifecycle, turn: parseTurnRef(data) } as OmnigentStreamEvent;
  }
  if (eventName === "response.incomplete") {
    const turn = parseTurnRef(data);
    return {
      type: "turn_incomplete",
      turn,
      reason: turn.incompleteReason ?? "",
    };
  }
  if (eventName === "turn.text.delta") return parseTextDelta(data);
  if (eventName === "turn.item.done") return parseItemDone(data);
  if (eventName === "session.status") return parseSessionStatus(data);
  if (eventName === "session.input.consumed") return parseInputConsumed(data);
  if (eventName === "session.interrupted") return parseInterrupted(data);
  return null;
}

function parseTextDelta(data: Wire): OmnigentStreamEvent | null {
  if (typeof data.delta !== "string") return null;
  return {
    type: "text_delta",
    delta: data.delta,
    ...(typeof data.message_id === "string"
      ? { messageId: data.message_id }
      : {}),
    ...(typeof data.index === "number" ? { index: data.index } : {}),
    ...(typeof data.final === "boolean" ? { final: data.final } : {}),
  };
}

function parseItemDone(data: Wire): OmnigentStreamEvent | null {
  const item = asRecord(data.item);
  if (item === null) return null;
  if (item.type !== "message" || item.is_meta === true) return null;
  return {
    type: "message_item",
    itemId: String(item.id ?? ""),
    turnId: String(item.response_id ?? ""),
    content: parseOmnigentMessageContent(item.content),
  };
}

function parseSessionStatus(data: Wire): OmnigentStreamEvent | null {
  const sessionId = data.conversation_id;
  const status = data.status;
  if (typeof sessionId !== "string" || sessionId === "") return null;
  if (
    status !== "idle" &&
    status !== "launching" &&
    status !== "running" &&
    status !== "waiting" &&
    status !== "failed"
  ) {
    return null;
  }
  return {
    type: "session_status",
    sessionId,
    status,
    ...(typeof data.response_id === "string"
      ? { turnId: data.response_id }
      : {}),
  };
}

function parseInputConsumed(data: Wire): OmnigentStreamEvent | null {
  const inner = asRecord(data.data);
  if (inner === null) return null;
  const itemId = inner.item_id;
  const itemType = inner.type;
  if (typeof itemId !== "string" || itemId === "") return null;
  if (typeof itemType !== "string" || itemType === "") return null;
  const payload = asRecord(inner.data) ?? {};
  return {
    type: "input_consumed",
    itemId,
    itemType,
    isMeta: payload.is_meta === true,
    ...(typeof inner.created_by === "string"
      ? { createdBy: inner.created_by }
      : {}),
    content: parseOmnigentMessageContent(payload.content),
    clearedPendingId:
      typeof inner.cleared_pending_id === "string"
        ? inner.cleared_pending_id
        : null,
  };
}

function parseInterrupted(data: Wire): OmnigentStreamEvent | null {
  const inner = asRecord(data.data);
  if (inner === null) return null;
  return {
    type: "session_interrupted",
    requestedAt: Number(inner.requested_at ?? 0),
    ...(typeof inner.response_id === "string"
      ? { turnId: inner.response_id }
      : {}),
  };
}

/** Turn fields arrive either at the top level or nested under `response`. */
function parseTurnRef(data: Wire): OmnigentTurnRef {
  const source = asRecord(data.response) ?? data;
  const incomplete = asRecord(source.incomplete_details);
  const error = asRecord(source.error);
  return {
    id: String(source.id ?? ""),
    status: String(source.status ?? ""),
    model: String(source.model ?? ""),
    incompleteReason:
      incomplete !== null ? String(incomplete.reason ?? "") : null,
    errorMessage: error !== null ? String(error.message ?? "") : null,
  };
}

function asRecord(value: unknown): Wire | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Wire;
}
