import type { WorkerRecovery } from "../contracts";
import type { WorkerUnreachable } from "../liveness/workerLiveness";
import { buildReconnectCommand } from "./reconnectCommand";

export interface RecoveryContext {
  sessionId: string;
  serverUrl: string;
  wrapper: string | null;
  isUnboundFork: boolean;
  sourceHostId: string | null;
}

export function recoveryOptionsFor(
  cause: WorkerUnreachable,
  ctx: RecoveryContext,
): WorkerRecovery[] {
  if (cause.reason === "orphaned") return [{ kind: "wait" }];
  if (cause.reason !== "stranded") return [];

  const out: WorkerRecovery[] = [
    { kind: "cli", command: buildReconnectCommand(ctx) },
  ];
  if (ctx.isUnboundFork) {
    out.push({
      kind: "resume-directory",
      sourceHostId: ctx.sourceHostId,
    });
  }
  out.push({ kind: "fork" });
  return out;
}

export function isUnboundCodingFork(
  labels: Record<string, string>,
  workspace: string | null | undefined,
): boolean {
  if (!labels["agent-cloud.fork.source_id"]) return false;
  return workspace == null || workspace === "";
}
