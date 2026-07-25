import type { AgentSessionSnapshot } from "../../contracts";
import type { OmnigentSessionState } from "./omnigentSessionState";

/**
 * Project working state into the shared view model.
 *
 * Memoized on `revision` so a subscriber that re-reads without an intervening
 * mutation gets a referentially stable snapshot — React bails out of the
 * re-render instead of reconciling the whole transcript.
 */
export class OmnigentSnapshotProjector {
  private cached: AgentSessionSnapshot | null = null;
  private cachedRevision = -1;

  project(state: OmnigentSessionState): AgentSessionSnapshot {
    if (this.cached !== null && this.cachedRevision === state.revision) {
      return this.cached;
    }
    const snapshot: AgentSessionSnapshot = {
      sessionId: state.sessionId,
      title: state.title,
      agentLabel: state.agentLabel,
      status: state.status,
      connection: state.connection,
      interactionMode: "acp",
      capabilities: {
        sendMessage: true,
        interrupt: state.activeTurnId !== null || state.status === "running",
        resolvePermission: false,
        updateConfiguration: false,
        terminal: false,
      },
      items: [...state.items],
      plan: [],
      permissions: [],
      terminals: [],
      hasOlderItems: state.hasOlderItems,
      error: state.error,
    };
    this.cached = snapshot;
    this.cachedRevision = state.revision;
    return snapshot;
  }

  invalidate(): void {
    this.cached = null;
    this.cachedRevision = -1;
  }
}
