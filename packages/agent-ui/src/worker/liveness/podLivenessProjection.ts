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
    return {
      state: "online",
      readOnly: input.controlGranted ? null : "permission",
    };
  }
  return { state: "starting", progress: input.initProgress };
}
