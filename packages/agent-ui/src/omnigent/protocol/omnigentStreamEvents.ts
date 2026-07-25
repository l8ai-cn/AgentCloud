import type { OmnigentMessageContentBlock } from "./omnigentMessageContent";

/**
 * Wire vocabulary of `GET /v1/sessions/{id}/stream`, mirroring
 * `sdks/python-client/omnigent_client/_events.py`. Event names follow the
 * wire (`turn.started` → `turn_started`), not any client-side alias.
 *
 * Only the subset the runtime currently reduces is modelled; unmodelled
 * events parse to `null` and are skipped rather than failing the stream.
 */

export interface OmnigentTurnRef {
  id: string;
  status: string;
  model: string;
  incompleteReason: string | null;
  errorMessage: string | null;
}

export interface OmnigentTurnStarted {
  type: "turn_started";
  turn: OmnigentTurnRef;
}

export interface OmnigentTurnCompleted {
  type: "turn_completed";
  turn: OmnigentTurnRef;
}

export interface OmnigentTurnFailed {
  type: "turn_failed";
  turn: OmnigentTurnRef;
}

/** Stopped early; `reason === "user_interrupt"` for an explicit cancel. */
export interface OmnigentTurnIncomplete {
  type: "turn_incomplete";
  turn: OmnigentTurnRef;
  reason: string;
}

export interface OmnigentTurnCancelled {
  type: "turn_cancelled";
  turn: OmnigentTurnRef;
}

/**
 * `messageId`/`index`/`final` are present only for terminal-observed live
 * streaming (claude-native), where deltas scope to a vendor message id
 * instead of grouping under the active turn.
 */
export interface OmnigentTextDelta {
  type: "text_delta";
  delta: string;
  messageId?: string;
  index?: number;
  final?: boolean;
}

export interface OmnigentMessageItem {
  type: "message_item";
  itemId: string;
  turnId: string;
  content: OmnigentMessageContentBlock[];
}

export interface OmnigentSessionStatus {
  type: "session_status";
  sessionId: string;
  status: "idle" | "launching" | "running" | "waiting" | "failed";
  turnId?: string;
}

/**
 * A queued input was persisted into history. Backfills the server-assigned
 * item id onto the optimistic user message. `clearedPendingId` is set when
 * the persisted item drained a server-side pending entry (a native-terminal
 * web message round-tripping back through the transcript).
 */
export interface OmnigentInputConsumed {
  type: "input_consumed";
  itemId: string;
  itemType: string;
  isMeta: boolean;
  createdBy?: string;
  content: OmnigentMessageContentBlock[];
  clearedPendingId: string | null;
}

/**
 * Co-emitted with `turn_incomplete` on an explicit cancel; distinguishes a
 * user interrupt from a generic transport abort.
 */
export interface OmnigentSessionInterrupted {
  type: "session_interrupted";
  requestedAt: number;
  turnId?: string;
}

export type OmnigentStreamEvent =
  | OmnigentTurnStarted
  | OmnigentTurnCompleted
  | OmnigentTurnFailed
  | OmnigentTurnIncomplete
  | OmnigentTurnCancelled
  | OmnigentTextDelta
  | OmnigentMessageItem
  | OmnigentSessionStatus
  | OmnigentInputConsumed
  | OmnigentSessionInterrupted;
