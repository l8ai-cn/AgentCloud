import type { WorkerRecovery } from "../contracts";

export type WorkerReadOnlyReason =
  | "permission"
  | "closed-subagent"
  | "native-subagent"
  | "ended";

export type WorkerUnreachable =
  | { reason: "stranded" }
  | { reason: "launch-failed"; detail: string | null }
  | { reason: "forbidden" }
  | { reason: "orphaned" };

export type WorkerLiveness =
  | { state: "unknown" }
  | { state: "starting"; progress: string | null }
  | { state: "online"; readOnly: WorkerReadOnlyReason | null }
  | {
      state: "unreachable";
      cause: WorkerUnreachable;
      recovery: WorkerRecovery[];
    };

export function isWorkerSessionReadable(liveness: WorkerLiveness): boolean {
  return liveness.state === "online" || liveness.state === "unknown";
}
