export interface PodLiveness {
  podStatus: string;
  isPodReady: boolean;
  podError: string | null;
}

// Shared by usePodStatus (terminal pane) and the agent-ui worker transport so
// the two surfaces can't disagree about when a pod counts as broken.
//
// "orphaned" is deliberately not an error: a runner restart auto-recovers it,
// so the UI shows a reconnecting state instead of a failure.
export function derivePodLiveness(pod?: { status?: string; error_message?: string }): PodLiveness {
  const podStatus = pod?.status ?? "unknown";
  let podError: string | null = null;
  if (podStatus === "terminated") {
    podError = "Pod terminated";
  } else if (podStatus === "error") {
    podError = pod?.error_message || "Pod error";
  }
  return { podStatus, isPodReady: podStatus === "running", podError };
}
