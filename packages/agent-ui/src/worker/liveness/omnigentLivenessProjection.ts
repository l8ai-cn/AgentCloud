import type { WorkerRecovery } from "../contracts";
import type { WorkerLiveness, WorkerReadOnlyReason } from "./workerLiveness";

export const STARTING_GRACE_S = 45;

export interface OmnigentLivenessInput {
  runnerOnline: boolean | undefined;
  hostId: string | null;
  createdAt: number;
  runnerEverOnline: boolean;
  readOnly: WorkerReadOnlyReason | null;
  recovery: WorkerRecovery[];
  now?: () => number;
}

export function projectOmnigentLiveness(
  input: OmnigentLivenessInput,
): WorkerLiveness {
  if (input.runnerOnline === true) {
    return { state: "online", readOnly: input.readOnly };
  }

  const nowS = (input.now?.() ?? Date.now()) / 1000;
  if (
    !input.runnerEverOnline &&
    input.createdAt > 0 &&
    nowS - input.createdAt < STARTING_GRACE_S
  ) {
    return { state: "starting", progress: null };
  }

  if (input.runnerOnline === undefined) return { state: "unknown" };

  // Host-bound but no real host_online signal — do not guess stranded.
  if (input.hostId) return { state: "unknown" };

  return {
    state: "unreachable",
    cause: { reason: "stranded" },
    recovery: input.recovery,
  };
}
