import { fromBinary } from "@bufbuild/protobuf";
import {
  projectPodLiveness,
  type WorkerLiveness,
  type WorkerRef,
  type WorkerTransport,
} from "@agent-cloud/agent-ui";
import { PodSchema } from "@proto/pod/v1/pod_pb";

import { fromProtoPod } from "@/lib/api/podProtoMap";
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
}

export function createPodWorkerTransport(
  options: PodWorkerTransportOptions,
): WorkerTransport {
  const sessionToPod = new Map<string, string>();
  const runtimes = new Map<string, { key: string; runtime: WebAgentWorkbenchRuntime }>();

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
      const runtime = new WebAgentWorkbenchRuntime({
        agentLabel,
        interactionMode,
        live,
        loadArtifact: createWebAgentWorkbenchArtifactLoader(state, { podKey }),
        sessionId,
        title,
        workspaceArtifactError,
      });
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
      void usePodStore.getState().fetchPod(podKey).catch(() => undefined);
      return usePodStore.subscribe(emit);
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
  const pod = readPod(podKey);
  const status = pod?.status ?? "unknown";
  const isPodReady = status === "running";
  let podError: string | null = null;
  if (status === "failed") podError = "Pod failed";
  else if (status === "terminated") podError = "Pod terminated";
  else if (status === "error") podError = pod?.error_message || "Pod error";

  return projectPodLiveness({
    controlGranted: options.isControlGranted(),
    initProgress: options.getInitProgressMessage(podKey),
    isPodReady,
    podError,
    podStatus: status,
  });
}
