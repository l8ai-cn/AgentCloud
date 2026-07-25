import { OmnigentSessionRuntime } from "../../omnigent/runtime/OmnigentSessionRuntime";
import type { OmnigentFetch } from "../../omnigent/transport/omnigentFetch";
import { createOmnigentWorkspaceFiles } from "../../omnigent/transport/omnigentWorkspaceFiles";
import type { WorkerRef, WorkerTransport } from "../contracts";
import { createOmnigentHealthPoll } from "../liveness/omnigentHealthPoll";
import { projectOmnigentLiveness } from "../liveness/omnigentLivenessProjection";
import type { WorkerLiveness } from "../liveness/workerLiveness";
import {
  isUnboundCodingFork,
  recoveryOptionsFor,
} from "../recovery/workerRecoveryOptions";
import { sessionReadOnlyReason } from "../recovery/sessionReadOnlyReason";

export interface OmnigentSessionMeta {
  hostId: string | null;
  createdAt: number;
  labels: Record<string, string>;
  workspace: string | null;
  permissionLevel: number | null;
  serverUrl: string;
}

export interface OmnigentWorkerTransportOptions {
  request: OmnigentFetch;
  getSessionMeta: (sessionId: string) => OmnigentSessionMeta | null;
  getStreamRunnerOnline?: (sessionId: string) => boolean | undefined;
  onRunnerOnlineEdge?: (sessionId: string) => void;
}

export function createOmnigentWorkerTransport(
  options: OmnigentWorkerTransportOptions,
): WorkerTransport {
  const runtime = new OmnigentSessionRuntime({ request: options.request });
  const everOnline = new Map<string, boolean>();
  const lastOnline = new Map<string, boolean | undefined>();
  const healthBySession = new Map<string, boolean>();
  const listeners = new Map<string, Set<(l: WorkerLiveness) => void>>();

  const computeLiveness = (sessionId: string): WorkerLiveness => {
    const meta = options.getSessionMeta(sessionId);
    const polled = healthBySession.has(sessionId)
      ? healthBySession.get(sessionId)
      : undefined;
    const streamed = options.getStreamRunnerOnline?.(sessionId);
    const runnerOnline = polled ?? streamed;
    if (runnerOnline === true) everOnline.set(sessionId, true);

    const prev = lastOnline.get(sessionId);
    if (runnerOnline === true && prev !== true) {
      options.onRunnerOnlineEdge?.(sessionId);
    }
    lastOnline.set(sessionId, runnerOnline);

    const labels = meta?.labels ?? {};
    const recovery =
      meta == null
        ? []
        : recoveryOptionsFor(
            { reason: "stranded" },
            {
              sessionId,
              serverUrl: meta.serverUrl,
              wrapper: labels["agent-cloud.wrapper"] ?? null,
              isUnboundFork: isUnboundCodingFork(labels, meta.workspace),
              sourceHostId: meta.hostId,
            },
          );

    return projectOmnigentLiveness({
      runnerOnline,
      hostId: meta?.hostId ?? null,
      createdAt: meta?.createdAt ?? 0,
      runnerEverOnline: everOnline.get(sessionId) === true,
      readOnly: sessionReadOnlyReason(labels, meta?.permissionLevel),
      recovery,
    });
  };

  const emit = (sessionId: string) => {
    const set = listeners.get(sessionId);
    if (!set || set.size === 0) return;
    const liveness = computeLiveness(sessionId);
    for (const listener of set) listener(liveness);
  };

  const poll = createOmnigentHealthPoll(options.request, (map) => {
    healthBySession.clear();
    for (const [id, entry] of map) {
      healthBySession.set(id, entry.runnerOnline);
    }
    for (const sessionId of listeners.keys()) emit(sessionId);
  });

  const syncPollSet = () => {
    poll.setSessionIds([...listeners.keys()]);
  };

  return {
    kind: "omnigent",
    workspaceFiles: createOmnigentWorkspaceFiles(options.request),

    async resolveSession(ref: WorkerRef): Promise<string> {
      if (ref.transport !== "omnigent") {
        throw new Error("omnigent transport requires omnigent ref");
      }
      return ref.sessionId;
    },

    runtimeFor() {
      return runtime;
    },

    closeSession(sessionId: string) {
      runtime.close(sessionId);
      everOnline.delete(sessionId);
      lastOnline.delete(sessionId);
      healthBySession.delete(sessionId);
    },

    subscribeLiveness(ref, listener) {
      if (ref.transport !== "omnigent") {
        listener({
          state: "unreachable",
          cause: { reason: "launch-failed", detail: "bad ref" },
          recovery: [],
        });
        return () => undefined;
      }
      const { sessionId } = ref;
      let set = listeners.get(sessionId);
      if (!set) {
        set = new Set();
        listeners.set(sessionId, set);
      }
      set.add(listener);
      syncPollSet();
      listener(computeLiveness(sessionId));
      return () => {
        set?.delete(listener);
        if (set && set.size === 0) {
          listeners.delete(sessionId);
          syncPollSet();
        }
      };
    },
  };
}
