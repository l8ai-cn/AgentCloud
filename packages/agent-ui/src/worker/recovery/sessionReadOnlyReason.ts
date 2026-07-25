import type { WorkerReadOnlyReason } from "../liveness/workerLiveness";

export function sessionReadOnlyReason(
  labels: Record<string, string>,
  permissionLevel: number | null | undefined,
): WorkerReadOnlyReason | null {
  if (permissionLevel === 1) return "permission";
  if (labels["agent-cloud.closed"] === "true") return "closed-subagent";
  if (labels["agent-cloud.wrapper"] === "claude-code-native-ui-subagent") {
    return "native-subagent";
  }
  return null;
}
