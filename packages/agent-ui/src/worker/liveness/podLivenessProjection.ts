import type { WorkerLiveness } from "./workerLiveness";

export type PodStatus =
  | "queued"
  | "initializing"
  | "running"
  | "paused"
  | "disconnected"
  | "orphaned"
  | "completed"
  | "terminated"
  | "error"
  | "failed"
  | "unknown";

export interface PodLivenessInput {
  podStatus: PodStatus | string;
  isPodReady: boolean;
  initProgress: string | null;
  podError: string | null;
  // Unused for conversation interactivity: control lease gates terminal writes
  // only. Workbench prompt/permission commands must stay available to observers.
  controlGranted: boolean;
}

export function projectPodLiveness(input: PodLivenessInput): WorkerLiveness {
  if (input.podError || input.podStatus === "error" || input.podStatus === "failed") {
    return {
      state: "unreachable",
      cause: { reason: "launch-failed", detail: input.podError },
      recovery: [],
    };
  }
  if (input.podStatus === "terminated") {
    return {
      state: "unreachable",
      cause: { reason: "orphaned" },
      recovery: [{ kind: "wait" }],
    };
  }
  // Orphaned pods stay readable while the runner auto-recovers — match AgentPanel.
  if (input.podStatus === "completed" || input.podStatus === "orphaned") {
    return { state: "online", readOnly: "ended" };
  }
  if (input.podStatus === "running" && input.isPodReady) {
    return { state: "online", readOnly: null };
  }
  // Cache miss / not yet projected. Must stay "unknown" (session-readable), not
  // "starting": deep-linked do-agent pages fetchPod async, and "starting"
  // blocks resolveSession — UI sticks on "Waiting for Worker to be ready…".
  if (input.podStatus === "unknown") {
    return { state: "unknown" };
  }
  return { state: "starting", progress: input.initProgress };
}
