import { fromBinary } from "@bufbuild/protobuf";
import {
  projectPodLiveness,
  type AgentSessionRuntime,
  type WorkerLiveness,
  type WorkerRef,
  type WorkerTransport,
} from "@agent-cloud/agent-ui";
import { PodSchema } from "@proto/pod/v1/pod_pb";

import { fromProtoPod } from "@/lib/api/podProtoMap";
import { derivePodLiveness } from "@/lib/pod-liveness";
import { dropUnreadablePodPane, isPodUnreadableForever } from "@/lib/unreadable-pod-pane";
import { getAgentWorkbenchState, getPodState } from "@/lib/wasm-core";
import { usePodStore, type Pod } from "@/stores/pod";

import { listPodWorkspaceFilesystem } from "@/lib/api/podWorkspaceArtifactApi";

import { resolveSessionByPodKey } from "./resolveSessionByPodKey";
import { WebAgentWorkbenchRuntime } from "./WebAgentWorkbenchRuntime";
import { createWebAgentWorkbenchArtifactLoader } from "./webAgentWorkbenchArtifactLoader";

export interface PodWorkerTransportOptions {
  isControlGranted: () => boolean;
  getInitProgressMessage: (podKey: string) => string | null;
  getWorkspaceArtifactError: (podKey: string) => string | null;
  /** Lets a domain host wrap the session runtime, e.g. to add slash commands. */
  decorateRuntime?: (
    runtime: AgentSessionRuntime,
    podKey: string,
  ) => AgentSessionRuntime;
}

export function createPodWorkerTransport(
  options: PodWorkerTransportOptions,
): WorkerTransport {
  const sessionToPod = new Map<string, string>();
  const runtimes = new Map<string, { key: string; runtime: AgentSessionRuntime }>();

  return {
    kind: "pod",
    workspaceFiles: {
      list: async (sessionId, dir) => {
        const podKey = sessionToPod.get(sessionId);
        if (!podKey) return [];
        return listPodWorkspaceFilesystem(podKey, dir);
      },
    },

    async resolveSession(ref: WorkerRef): Promise<string> {
      if (ref.transport !== "pod") {
        throw new Error("pod transport requires pod ref");
      }
      const sessionId = await resolveSessionByPodKey(ref.podKey);
      sessionToPod.set(sessionId, ref.podKey);
      return sessionId;
    },

    runtimeFor(sessionId: string) {
      const podKey = sessionToPod.get(sessionId);
      if (!podKey) throw new Error("pod_session_not_resolved");
      const pod = readPod(podKey);
      const status = pod?.status ?? "unknown";
      const live = status === "running";
      const title = pod?.title ?? pod?.alias ?? podKey;
      const agentLabel = pod?.agent?.name ?? "Agent";
      const interactionMode = pod?.interaction_mode ?? "acp";
      const workspaceArtifactError = options.getWorkspaceArtifactError(podKey);
      const key = [
        sessionId,
        live,
        title,
        agentLabel,
        interactionMode,
        workspaceArtifactError ?? "",
      ].join("|");
      const existing = runtimes.get(sessionId);
      if (existing?.key === key) return existing.runtime;
      existing?.runtime.close(sessionId);
      const state = getAgentWorkbenchState();
      const base = new WebAgentWorkbenchRuntime({
        agentLabel,
        interactionMode,
        live,
        loadArtifact: createWebAgentWorkbenchArtifactLoader(state, { podKey }),
        sessionId,
        title,
        workspaceArtifactError,
      });
      const runtime = options.decorateRuntime?.(base, podKey) ?? base;
      runtimes.set(sessionId, { key, runtime });
      return runtime;
    },

    closeSession(sessionId: string) {
      const cached = runtimes.get(sessionId);
      if (!cached) return;
      cached.runtime.close(sessionId);
      runtimes.delete(sessionId);
    },

    subscribeLiveness(ref, listener) {
      if (ref.transport !== "pod") {
        listener({
          state: "unreachable",
          cause: { reason: "launch-failed", detail: "bad ref" },
          recovery: [],
        });
        return () => undefined;
      }
      const { podKey } = ref;
      const emit = () => listener(readPodLiveness(podKey, options));
      emit();
      let cancelled = false;
      void (async () => {
        let lastError: unknown;
        let unreadable = false;
        for (let attempt = 0; attempt < 8 && !cancelled; attempt += 1) {
          try {
            await usePodStore.getState().fetchPod(podKey);
            if (!cancelled) emit();
            return;
          } catch (error) {
            lastError = error;
            if (isPodUnreadableForever(error)) {
              unreadable = true;
              break;
            }
            await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
            if (!cancelled) emit();
          }
        }
        if (cancelled) return;
        const current = readPodLiveness(podKey, options);
        if (current.state === "online") return;
        if (unreadable) {
          dropUnreadablePodPane(podKey);
          listener({ state: "unreachable", cause: { reason: "forbidden" }, recovery: [] });
          return;
        }
        listener({
          state: "unreachable",
          cause: {
            reason: "launch-failed",
            detail:
              lastError instanceof Error
                ? lastError.message
                : "Failed to load Worker status",
          },
          recovery: [],
        });
      })();
      const unsub = usePodStore.subscribe(emit);
      return () => {
        cancelled = true;
        unsub();
      };
    },
  };
}

function readPod(podKey: string): Pod | undefined {
  const bytes = getPodState().get_pod_bytes(podKey);
  if (bytes.length === 0) return undefined;
  return fromProtoPod(fromBinary(PodSchema, bytes)) as Pod;
}

function readPodLiveness(
  podKey: string,
  options: PodWorkerTransportOptions,
): WorkerLiveness {
  const { podStatus, isPodReady, podError } = derivePodLiveness(readPod(podKey));

  return projectPodLiveness({
    controlGranted: options.isControlGranted(),
    initProgress: options.getInitProgressMessage(podKey),
    isPodReady,
    podError,
    podStatus,
  });
}
