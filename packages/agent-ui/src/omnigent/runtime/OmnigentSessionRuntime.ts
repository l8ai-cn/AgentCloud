import type { AgentSessionRuntime } from "../../agentSessionRuntime";
import type { AgentSessionSnapshot } from "../../contracts";
import type { OmnigentFetch } from "../transport/omnigentFetch";
import {
  omnigentFrameScheduler,
} from "./omnigentNotifyScheduler";
import type { OmnigentScheduler } from "./omnigentNotifyScheduler";
import { OmnigentSessionBinding } from "./omnigentSessionBinding";
import { createOmnigentSessionState } from "./omnigentSessionState";
import { OmnigentSnapshotProjector } from "./omnigentSnapshotProjection";

export interface OmnigentSessionRuntimeOptions {
  request: OmnigentFetch;
  scheduler?: OmnigentScheduler;
  random?: () => number;
}

/**
 * `AgentSessionRuntime` over the Omnigent `/v1` REST + SSE surface.
 *
 * Sibling to the Connect-backed runtime: both project into the same
 * `AgentSessionSnapshot`, so the workspace UI is transport-agnostic.
 */
export class OmnigentSessionRuntime implements AgentSessionRuntime {
  private readonly bindings = new Map<string, OmnigentSessionBinding>();
  private readonly detachedProjector = new OmnigentSnapshotProjector();

  constructor(private readonly options: OmnigentSessionRuntimeOptions) {}

  open(sessionId: string): Promise<void> {
    const existing = this.bindings.get(sessionId);
    if (existing !== undefined) return Promise.resolve();
    const binding = new OmnigentSessionBinding(sessionId, {
      request: this.options.request,
      scheduler: this.options.scheduler ?? omnigentFrameScheduler,
      ...(this.options.random !== undefined ? { random: this.options.random } : {}),
    });
    this.bindings.set(sessionId, binding);
    return binding.start();
  }

  close(sessionId: string): void {
    this.bindings.get(sessionId)?.close();
    this.bindings.delete(sessionId);
  }

  getSnapshot(sessionId: string): AgentSessionSnapshot {
    const binding = this.bindings.get(sessionId);
    if (binding !== undefined) return binding.snapshot();
    // A reader can outlive its binding for one render after close; an empty
    // projection is preferable to throwing inside a subscription callback.
    return this.detachedProjector.project(createOmnigentSessionState(sessionId));
  }

  subscribe(sessionId: string, listener: () => void): () => void {
    return this.bindings.get(sessionId)?.subscribe(listener) ?? (() => {});
  }

  sendMessage(
    sessionId: string,
    commandId: string,
    input: { text: string },
  ): Promise<void> {
    return this.binding(sessionId).sendMessage(commandId, input.text);
  }

  interrupt(sessionId: string): Promise<void> {
    return this.binding(sessionId).interrupt();
  }

  loadOlder(sessionId: string): Promise<void> {
    return this.binding(sessionId).loadOlder();
  }

  resolvePermission(): Promise<void> {
    return Promise.reject(new Error("omnigent_permissions_not_implemented"));
  }

  updateConfiguration(): Promise<void> {
    return Promise.reject(new Error("omnigent_configuration_not_implemented"));
  }

  private binding(sessionId: string): OmnigentSessionBinding {
    const binding = this.bindings.get(sessionId);
    if (binding === undefined) {
      throw new Error(`omnigent session not open: ${sessionId}`);
    }
    return binding;
  }
}
