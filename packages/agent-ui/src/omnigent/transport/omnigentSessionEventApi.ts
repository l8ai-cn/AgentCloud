import type { OmnigentMessageContentBlock } from "../protocol/omnigentMessageContent";
import { omnigentApiError } from "./omnigentFetch";
import type { OmnigentFetch } from "./omnigentFetch";

export type OmnigentSessionEvent =
  | { type: "message"; data: { content: OmnigentMessageContentBlock[] } }
  | { type: "interrupt"; data: Record<string, never> };

export interface OmnigentEventReceipt {
  queued: boolean;
  /** Server-assigned item id, when the input persisted synchronously. */
  itemId?: string;
  /** A policy rejected the input. */
  denied?: boolean;
  /**
   * Set when the server parked the input as a pending entry (native-terminal
   * sessions). The matching `input_consumed` event echoes it back as
   * `clearedPendingId`, letting the optimistic message be dropped by id
   * rather than by FIFO position.
   */
  pendingId?: string;
}

interface ReceiptWire {
  queued: boolean;
  item_id?: string;
  denied?: boolean;
  pending_id?: string;
}

/**
 * Item-typed events persist synchronously before the route returns; the
 * `session.input.consumed` stream event follows.
 */
export async function postOmnigentSessionEvent(
  request: OmnigentFetch,
  sessionId: string,
  event: OmnigentSessionEvent,
): Promise<OmnigentEventReceipt> {
  const response = await request(
    `/v1/sessions/${encodeURIComponent(sessionId)}/events`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    },
  );
  if (!response.ok) throw await omnigentApiError(response);
  const wire = (await response.json()) as ReceiptWire;
  return {
    queued: wire.queued,
    ...(wire.item_id !== undefined ? { itemId: wire.item_id } : {}),
    ...(wire.denied !== undefined ? { denied: wire.denied } : {}),
    ...(wire.pending_id !== undefined ? { pendingId: wire.pending_id } : {}),
  };
}

export function sendOmnigentMessage(
  request: OmnigentFetch,
  sessionId: string,
  content: OmnigentMessageContentBlock[],
): Promise<OmnigentEventReceipt> {
  return postOmnigentSessionEvent(request, sessionId, {
    type: "message",
    data: { content },
  });
}

/**
 * Co-emits `session.interrupted` and `turn_incomplete` (reason
 * `user_interrupt`) on the live stream.
 */
export function interruptOmnigentSession(
  request: OmnigentFetch,
  sessionId: string,
): Promise<OmnigentEventReceipt> {
  return postOmnigentSessionEvent(request, sessionId, {
    type: "interrupt",
    data: {},
  });
}
