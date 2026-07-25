import {
  parseOmnigentMessageContent,
} from "../protocol/omnigentMessageContent";
import type { OmnigentMessageContentBlock } from "../protocol/omnigentMessageContent";
import { omnigentJson } from "./omnigentFetch";
import type { OmnigentFetch } from "./omnigentFetch";

export type OmnigentSessionStatus =
  | "idle"
  | "launching"
  | "running"
  | "waiting"
  | "failed";

/**
 * Un-consumed web-composer messages on native-terminal sessions. Replayed
 * on bind so a client that posted and then navigated away re-hydrates the
 * optimistic bubble instead of losing it.
 */
export interface OmnigentPendingInput {
  pendingId: string;
  content: OmnigentMessageContentBlock[];
  createdBy?: string;
}

export interface OmnigentSessionSnapshot {
  sessionId: string;
  agentId: string;
  agentLabel: string;
  title: string;
  status: OmnigentSessionStatus;
  /** Turn currently in flight; the turn-start SSE edge is not replayed. */
  activeTurnId: string | null;
  pendingInputs: OmnigentPendingInput[];
}

interface SessionWire {
  id: string;
  agent_id?: string;
  agent_name?: string | null;
  title?: string | null;
  status?: string;
  active_response_id?: string | null;
  pending_inputs?: Array<{
    pending_id: string;
    content: unknown;
    created_by?: string;
  }>;
}

/**
 * `refreshState` asks the server to re-derive live session state before
 * answering; a cached snapshot goes stale once the agent commits items while
 * the user is viewing another session.
 */
export async function fetchOmnigentSessionSnapshot(
  request: OmnigentFetch,
  sessionId: string,
  options: { refreshState?: boolean } = {},
): Promise<OmnigentSessionSnapshot> {
  const query = options.refreshState ? "?refresh_state=true" : "";
  const wire = await omnigentJson<SessionWire>(
    await request(`/v1/sessions/${encodeURIComponent(sessionId)}${query}`),
  );
  return {
    sessionId: wire.id,
    agentId: wire.agent_id ?? "",
    agentLabel: wire.agent_name ?? wire.agent_id ?? "",
    title: wire.title ?? "",
    status: parseStatus(wire.status),
    activeTurnId: wire.active_response_id ?? null,
    pendingInputs: (wire.pending_inputs ?? []).map((entry) => ({
      pendingId: entry.pending_id,
      content: parseOmnigentMessageContent(entry.content),
      ...(entry.created_by !== undefined ? { createdBy: entry.created_by } : {}),
    })),
  };
}

function parseStatus(raw: unknown): OmnigentSessionStatus {
  return raw === "launching" || raw === "running" || raw === "failed"
    ? raw
    : "idle";
}
