import type { AgentSessionRuntime } from "../agentSessionRuntime";
import {
  refKey,
  type WorkerRef,
  type WorkerTransport,
} from "./contracts";

export class WorkerClient {
  private readonly transports = new Map<
    WorkerRef["transport"],
    WorkerTransport
  >();
  private readonly sessions = new Map<string, Promise<string>>();

  register(transport: WorkerTransport): void {
    this.transports.set(transport.kind, transport);
  }

  transportFor(ref: WorkerRef): WorkerTransport {
    const transport = this.transports.get(ref.transport);
    if (!transport) {
      throw new Error(`no transport registered for ${ref.transport}`);
    }
    return transport;
  }

  resolveSession(ref: WorkerRef): Promise<string> {
    const key = refKey(ref);
    let pending = this.sessions.get(key);
    if (!pending) {
      pending = this.transportFor(ref)
        .resolveSession(ref)
        .catch((error: unknown) => {
          this.sessions.delete(key);
          throw error;
        });
      this.sessions.set(key, pending);
    }
    return pending;
  }

  runtimeFor(ref: WorkerRef, sessionId: string): AgentSessionRuntime {
    return this.transportFor(ref).runtimeFor(sessionId);
  }

  release(sessionId: string): void {
    for (const transport of this.transports.values()) {
      transport.closeSession?.(sessionId);
    }
  }

  clearSession(ref: WorkerRef): void {
    this.sessions.delete(refKey(ref));
  }
}
