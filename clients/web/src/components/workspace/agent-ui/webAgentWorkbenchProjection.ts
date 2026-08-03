import { fromBinary } from "@bufbuild/protobuf";

import {
  projectGeneratedSessionSnapshot,
  type AgentConnectionStatus,
  type AgentSessionSnapshot,
  type TerminalResource,
} from "@agent-cloud/agent-ui";
import {
  SessionSnapshotSchema,
  type SessionSnapshot,
} from "@proto/agent_workbench/v2/session_pb";

export interface WebAgentWorkbenchProjectionContext {
  agentLabel: string;
  interactionMode: "acp" | "pty";
  sessionId: string;
  title: string;
}

export function decodeWebAgentWorkbenchSnapshot(
  bytes: Uint8Array | undefined,
  sessionId: string,
): SessionSnapshot | null {
  if (!bytes?.length) return null;
  const snapshot = fromBinary(SessionSnapshotSchema, bytes);
  if (snapshot.sessionId !== sessionId) {
    throw new Error("agent_workbench_state_session_mismatch");
  }
  return snapshot;
}

export function projectWebAgentWorkbenchSnapshot(
  raw: SessionSnapshot | null,
  context: WebAgentWorkbenchProjectionContext,
  connection: AgentConnectionStatus,
  transportError: string | null,
): AgentSessionSnapshot {
  if (!raw) {
    return ensurePtyTerminalSurface(
      emptySnapshot(context, connection, transportError),
    );
  }
  const projected = projectGeneratedSessionSnapshot(raw, {
    agentLabel: context.agentLabel,
    connection,
    hasOlderItems: false,
    interactionMode: context.interactionMode,
    title: context.title,
  });
  const withError = transportError && !projected.error
    ? { ...projected, error: transportError }
    : projected;
  return ensurePtyTerminalSurface(withError);
}

// PTY bytes stay on the relay data plane; the workbench resource can lag the
// first paint, so keep a host-controlled main terminal available for the tab.
function ensurePtyTerminalSurface(
  snapshot: AgentSessionSnapshot,
): AgentSessionSnapshot {
  if (snapshot.interactionMode !== "pty") return snapshot;
  const terminals: TerminalResource[] =
    snapshot.terminals.length > 0
      ? [...snapshot.terminals]
      : [
          {
            controlMode: "host",
            id: "main",
            label: "main:tui",
            status:
              snapshot.connection === "connected" ? "connected" : "connecting",
            writable: true,
          },
        ];
  return {
    ...snapshot,
    capabilities: { ...snapshot.capabilities, terminal: true },
    terminals,
  };
}

function emptySnapshot(
  context: WebAgentWorkbenchProjectionContext,
  connection: AgentConnectionStatus,
  error: string | null,
): AgentSessionSnapshot {
  return {
    agentLabel: context.agentLabel,
    capabilities: {
      interrupt: false,
      resolvePermission: false,
      sendMessage: false,
      terminal: false,
      updateConfiguration: false,
    },
    connection,
    error,
    hasOlderItems: false,
    interactionMode: context.interactionMode,
    items: [],
    permissions: [],
    plan: [],
    sessionId: context.sessionId,
    status: "launching",
    terminals: [],
    title: context.title,
  };
}
