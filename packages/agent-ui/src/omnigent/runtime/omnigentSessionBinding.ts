import type { AgentMessageItem, AgentSessionSnapshot } from "../../contracts";
import type { OmnigentFetch } from "../transport/omnigentFetch";
import {
  fetchOmnigentHistoryPage,
  fetchOmnigentInitialHistory,
} from "../transport/omnigentSessionHistoryApi";
import { fetchOmnigentSessionSnapshot } from "../transport/omnigentSessionSnapshotApi";
import {
  interruptOmnigentSession,
  sendOmnigentMessage,
} from "../transport/omnigentSessionEventApi";
import { openOmnigentSessionStream } from "../transport/omnigentSessionStreamApi";
import { backfillOmnigentGap } from "./omnigentReconnectBackfill";
import { mergeOmnigentHistoryPage } from "./omnigentHistoryMerge";
import { OmnigentNotifier } from "./omnigentNotifyScheduler";
import type { OmnigentScheduler } from "./omnigentNotifyScheduler";
import { OmnigentPendingQueue } from "./omnigentPendingMessages";
import {
  appendOmnigentItem,
  createOmnigentSessionState,
  rekeyOmnigentItem,
  removeOmnigentItem,
  updateOmnigentItem,
} from "./omnigentSessionState";
import type { OmnigentSessionState } from "./omnigentSessionState";
import { OmnigentSnapshotProjector } from "./omnigentSnapshotProjection";
import { runOmnigentStreamPump } from "./omnigentStreamPump";
import { applyOmnigentStreamEvent } from "./omnigentTimelineReducer";

export interface OmnigentBindingDeps {
  request: OmnigentFetch;
  scheduler: OmnigentScheduler;
  random?: () => number;
}

export class OmnigentSessionBinding {
  private readonly state: OmnigentSessionState;
  private readonly pending = new OmnigentPendingQueue();
  private readonly projector = new OmnigentSnapshotProjector();
  private readonly listeners = new Set<() => void>();
  private readonly controller = new AbortController();
  private readonly notifier: OmnigentNotifier;
  private hydration: Promise<void> | null = null;

  constructor(
    private readonly sessionId: string,
    private readonly deps: OmnigentBindingDeps,
  ) {
    this.state = createOmnigentSessionState(sessionId);
    this.notifier = new OmnigentNotifier(deps.scheduler, () => {
      for (const listener of this.listeners) listener();
    });
  }

  /**
   * Open the live tail *before* awaiting any hydration request: events
   * emitted during the snapshot/history window need a subscribed stream to
   * land on, and proxies can withhold SSE headers until the first byte, so
   * awaiting the stream first would deadlock the hydration it must precede.
   */
  start(): Promise<void> {
    void this.pump();
    this.hydration ??= this.hydrate();
    return this.hydration;
  }

  private async hydrate(): Promise<void> {
    try {
      const [snapshot, history] = await Promise.all([
        fetchOmnigentSessionSnapshot(this.deps.request, this.sessionId, {
          refreshState: true,
        }),
        fetchOmnigentInitialHistory(this.deps.request, this.sessionId),
      ]);
      if (this.controller.signal.aborted) return;
      this.state.title = snapshot.title;
      this.state.agentLabel = snapshot.agentLabel;
      this.state.status = snapshot.status;
      this.state.activeTurnId = snapshot.activeTurnId;
      mergeOmnigentHistoryPage(this.state, history);
      this.state.revision++;
    } catch (error) {
      if (this.controller.signal.aborted) return;
      this.state.error = errorMessage(error);
      this.state.revision++;
    }
    this.notifier.request();
  }

  private pump(): Promise<void> {
    return runOmnigentStreamPump({
      signal: this.controller.signal,
      ...(this.deps.random !== undefined ? { random: this.deps.random } : {}),
      openStream: (signal) =>
        openOmnigentSessionStream(this.deps.request, this.sessionId, signal),
      onEvent: (event) => {
        applyOmnigentStreamEvent(this.state, this.pending, event);
        this.notifier.request();
      },
      onConnectionChange: (connection) => {
        if (this.state.connection === connection) return;
        this.state.connection = connection;
        this.state.revision++;
        this.notifier.request();
      },
      onReconnected: async () => {
        await backfillOmnigentGap(this.state, (olderThan) =>
          fetchOmnigentHistoryPage(
            this.deps.request,
            this.sessionId,
            olderThan !== undefined ? { olderThan } : {},
          ),
        );
        this.notifier.request();
      },
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot(): AgentSessionSnapshot {
    return this.projector.project(this.state);
  }

  async sendMessage(commandId: string, text: string): Promise<void> {
    const localId = `omnigent:local:${commandId}`;
    appendOmnigentItem(this.state, {
      id: localId,
      kind: "message",
      role: "user",
      text,
      status: "completed",
    });
    this.pending.enqueue(localId);
    this.notifier.request();

    try {
      const receipt = await sendOmnigentMessage(this.deps.request, this.sessionId, [
        { type: "input_text", text },
      ]);
      if (receipt.denied === true) {
        this.failOptimisticMessage(localId);
        return;
      }
      if (receipt.itemId !== undefined) {
        this.pending.forget(localId);
        rekeyOmnigentItem(this.state, localId, receipt.itemId);
      } else if (receipt.pendingId !== undefined) {
        this.pending.attachPendingId(localId, receipt.pendingId);
      }
    } catch (error) {
      this.pending.forget(localId);
      removeOmnigentItem(this.state, localId);
      this.state.error = errorMessage(error);
      throw error;
    } finally {
      this.notifier.request();
    }
  }

  async interrupt(): Promise<void> {
    await interruptOmnigentSession(this.deps.request, this.sessionId);
  }

  async loadOlder(): Promise<void> {
    if (!this.state.hasOlderItems) return;
    const cursor = this.state.oldestItemId;
    if (cursor === null) return;
    const page = await fetchOmnigentHistoryPage(this.deps.request, this.sessionId, {
      olderThan: cursor,
    });
    if (this.controller.signal.aborted) return;
    mergeOmnigentHistoryPage(this.state, page);
    this.notifier.request();
  }

  close(): void {
    this.controller.abort();
    this.notifier.dispose();
    this.listeners.clear();
    this.pending.clear();
  }

  private failOptimisticMessage(localId: string): void {
    this.pending.forget(localId);
    updateOmnigentItem<AgentMessageItem>(this.state, localId, (item) => ({
      ...item,
      status: "failed",
    }));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
