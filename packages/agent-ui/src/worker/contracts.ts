import type { AgentSessionRuntime } from "../agentSessionRuntime";
import type { WorkerLiveness } from "./liveness/workerLiveness";

export interface WorkerAuth {
  baseUrl: string;
  getAccessToken(): Promise<string>;
  orgSlug?: string;
}

export type WorkerRef =
  | { transport: "pod"; podKey: string }
  | { transport: "omnigent"; sessionId: string };

export type WorkerRecovery =
  | { kind: "cli"; command: string }
  | { kind: "resume-directory"; sourceHostId: string | null }
  | { kind: "fork" }
  | { kind: "wait" };

export interface WorkspaceFileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
}

export interface WorkspaceFileSource {
  list(sessionId: string, dir: string): Promise<WorkspaceFileEntry[]>;
  exists?(sessionId: string, path: string): Promise<boolean>;
}

export interface WorkerDirectorySource {
  // Filled in P5.
}

export interface WorkerTransport {
  readonly kind: WorkerRef["transport"];
  resolveSession(ref: WorkerRef): Promise<string>;
  runtimeFor(sessionId: string): AgentSessionRuntime;
  closeSession?(sessionId: string): void;
  subscribeLiveness(
    ref: WorkerRef,
    listener: (liveness: WorkerLiveness) => void,
  ): () => void;
  workspaceFiles?: WorkspaceFileSource;
  directory?: WorkerDirectorySource;
}

export function refKey(ref: WorkerRef): string {
  return ref.transport === "pod"
    ? `pod:${ref.podKey}`
    : `omnigent:${ref.sessionId}`;
}
