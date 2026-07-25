import type { AgentMessageItem } from "../../contracts";
import { omnigentContentText } from "../protocol/omnigentMessageContent";
import type { OmnigentStreamEvent } from "../protocol/omnigentStreamEvents";
import type { OmnigentPendingQueue } from "./omnigentPendingMessages";
import {
  appendOmnigentItem,
  hasOmnigentItem,
  rekeyOmnigentItem,
  updateOmnigentItem,
} from "./omnigentSessionState";
import type { OmnigentSessionState } from "./omnigentSessionState";

export function applyOmnigentStreamEvent(
  state: OmnigentSessionState,
  pending: OmnigentPendingQueue,
  event: OmnigentStreamEvent,
): void {
  switch (event.type) {
    case "turn_started":
      state.activeTurnId = event.turn.id;
      state.streamingItemId = null;
      state.status = "running";
      state.error = null;
      break;

    case "turn_completed":
    case "turn_incomplete":
    case "turn_cancelled":
      settleStreamingItem(state, "completed");
      state.activeTurnId = null;
      state.status = "idle";
      break;

    case "turn_failed":
      settleStreamingItem(state, "failed");
      state.activeTurnId = null;
      state.status = "failed";
      state.error = event.turn.errorMessage;
      break;

    case "text_delta":
      appendTextDelta(state, event.delta, event.messageId);
      if (event.final === true) settleStreamingItem(state, "completed");
      break;

    case "message_item":
      finalizeAssistantMessage(state, event.itemId, event.content);
      break;

    case "session_status":
      state.status = event.status;
      if (event.status !== "running") state.activeTurnId = null;
      break;

    case "input_consumed":
      settleUserMessage(state, pending, event);
      break;

    case "session_interrupted":
      // Native-terminal sessions may not emit a turn lifecycle edge for an
      // interrupt, so settle here rather than waiting for one.
      settleStreamingItem(state, "completed");
      state.activeTurnId = null;
      state.status = "idle";
      break;
  }
}

function appendTextDelta(
  state: OmnigentSessionState,
  delta: string,
  messageId: string | undefined,
): void {
  const itemId = streamingItemId(state, messageId);
  if (!hasOmnigentItem(state, itemId)) {
    appendOmnigentItem(state, {
      id: itemId,
      kind: "message",
      role: "assistant",
      text: delta,
      status: "streaming",
    });
    state.streamingItemId = itemId;
    return;
  }
  state.streamingItemId = itemId;
  updateOmnigentItem<AgentMessageItem>(state, itemId, (item) => ({
    ...item,
    text: item.text + delta,
  }));
}

/**
 * The finalized item carries the server id the streaming placeholder lacked.
 * Rekeying rather than replacing keeps the bubble's position and any scroll
 * anchor pointing at it.
 */
function finalizeAssistantMessage(
  state: OmnigentSessionState,
  itemId: string,
  content: Parameters<typeof omnigentContentText>[0],
): void {
  const text = omnigentContentText(content);
  const streaming = state.streamingItemId;

  if (streaming !== null && !hasOmnigentItem(state, itemId)) {
    rekeyOmnigentItem(state, streaming, itemId);
    updateOmnigentItem<AgentMessageItem>(state, itemId, (item) => ({
      ...item,
      text,
      status: "completed",
    }));
    state.streamingItemId = null;
    return;
  }

  if (hasOmnigentItem(state, itemId)) {
    updateOmnigentItem<AgentMessageItem>(state, itemId, (item) => ({
      ...item,
      text,
      status: "completed",
    }));
    return;
  }

  appendOmnigentItem(state, {
    id: itemId,
    kind: "message",
    role: "assistant",
    text,
    status: "completed",
  });
}

function settleUserMessage(
  state: OmnigentSessionState,
  pending: OmnigentPendingQueue,
  event: Extract<OmnigentStreamEvent, { type: "input_consumed" }>,
): void {
  if (event.itemType !== "message" || event.isMeta) return;
  if (hasOmnigentItem(state, event.itemId)) return;

  const localId = pending.claim(event.clearedPendingId);
  if (localId !== null && hasOmnigentItem(state, localId)) {
    rekeyOmnigentItem(state, localId, event.itemId);
    return;
  }

  appendOmnigentItem(state, {
    id: event.itemId,
    kind: "message",
    role: "user",
    text: omnigentContentText(event.content),
    status: "completed",
  });
}

function settleStreamingItem(
  state: OmnigentSessionState,
  status: "completed" | "failed",
): void {
  const itemId = state.streamingItemId;
  if (itemId === null) return;
  updateOmnigentItem<AgentMessageItem>(state, itemId, (item) => ({
    ...item,
    status,
  }));
  state.streamingItemId = null;
}

function streamingItemId(
  state: OmnigentSessionState,
  messageId: string | undefined,
): string {
  if (messageId !== undefined) return `omnigent:message:${messageId}`;
  return `omnigent:turn:${state.activeTurnId ?? "detached"}:text`;
}
