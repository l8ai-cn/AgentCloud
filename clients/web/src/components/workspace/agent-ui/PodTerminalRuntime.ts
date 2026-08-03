import type {
  AgentConnectionStatus,
  TerminalControlLease,
  TerminalResource,
  TerminalRuntime,
} from "@agent-cloud/agent-ui";

import { relayPool } from "@/stores/workspace";

type OutputListener = (bytes: Uint8Array) => void;
type StatusListener = (status: AgentConnectionStatus) => void;

interface PodTerminalConnection {
  send: (data: string) => void;
  unsubscribe: () => void;
  stopStatus: () => void;
}

// PTY bytes stay on the relay data plane, so the workbench terminal resource is
// backed by the same pod subscription the legacy terminal pane used. Control is
// host-owned (WorkerControlOverlay holds the pod lease), which is why the lease
// calls below delegate straight to the pod pool instead of minting their own.
export class PodTerminalRuntime implements TerminalRuntime {
  private readonly connections = new Map<string, PodTerminalConnection>();
  private readonly outputListeners = new Map<string, Set<OutputListener>>();
  private readonly statusListeners = new Map<string, Set<StatusListener>>();

  constructor(
    private readonly podKey: string,
    private readonly subscriptionId: string,
  ) {}

  async connect(resource: TerminalResource): Promise<void> {
    if (this.connections.has(resource.id)) return;
    this.publishStatus(resource.id, "connecting");
    const stopStatus = relayPool.onStatusChange(this.podKey, (info) => {
      if (info.status === "none") return;
      this.publishStatus(resource.id, relayStatus(info.status));
    });
    const placeholder: PodTerminalConnection = {
      send: () => undefined,
      unsubscribe: () => undefined,
      stopStatus,
    };
    this.connections.set(resource.id, placeholder);
    try {
      const handle = await relayPool.subscribe(
        this.podKey,
        this.subscriptionId,
        (data) => this.publishOutput(resource.id, data),
      );
      if (!this.connections.has(resource.id)) {
        handle.unsubscribe();
        return;
      }
      this.connections.set(resource.id, { ...handle, stopStatus });
    } catch (error) {
      this.disconnect(resource.id);
      this.publishStatus(resource.id, "disconnected");
      throw error;
    }
  }

  disconnect(resourceId: string): void {
    const connection = this.connections.get(resourceId);
    if (!connection) return;
    this.connections.delete(resourceId);
    connection.stopStatus();
    connection.unsubscribe();
  }

  subscribeOutput(resourceId: string, listener: OutputListener): () => void {
    return subscribe(this.outputListeners, resourceId, listener);
  }

  subscribeStatus(resourceId: string, listener: StatusListener): () => void {
    return subscribe(this.statusListeners, resourceId, listener);
  }

  async write(resourceId: string, bytes: Uint8Array): Promise<void> {
    this.requireConnection(resourceId).send(new TextDecoder().decode(bytes));
  }

  async resize(resourceId: string, columns: number, rows: number): Promise<void> {
    this.requireConnection(resourceId);
    relayPool.sendResize(this.podKey, columns, rows);
  }

  async acquireControl(
    resourceId: string,
    clientLabel: string,
  ): Promise<TerminalControlLease> {
    this.requireConnection(resourceId);
    await relayPool.acquireControl(this.podKey, clientLabel);
    return { leaseId: this.podKey, expiresAt: Number.POSITIVE_INFINITY };
  }

  async renewControl(resourceId: string, leaseId: string): Promise<void> {
    this.requireConnection(resourceId);
    await relayPool.renewControl(this.podKey, leaseId);
  }

  async releaseControl(resourceId: string, leaseId: string): Promise<void> {
    this.requireConnection(resourceId);
    await relayPool.releaseControl(this.podKey, leaseId);
  }

  close(): void {
    for (const resourceId of [...this.connections.keys()]) {
      this.disconnect(resourceId);
    }
    this.outputListeners.clear();
    this.statusListeners.clear();
  }

  private requireConnection(resourceId: string): PodTerminalConnection {
    const connection = this.connections.get(resourceId);
    if (!connection) throw new Error("pod_terminal_not_connected");
    return connection;
  }

  private publishOutput(resourceId: string, data: Uint8Array | string): void {
    const bytes =
      typeof data === "string" ? new TextEncoder().encode(data) : data;
    this.outputListeners.get(resourceId)?.forEach((listener) => listener(bytes));
  }

  private publishStatus(
    resourceId: string,
    status: AgentConnectionStatus,
  ): void {
    this.statusListeners.get(resourceId)?.forEach((listener) => listener(status));
  }
}

function subscribe<Listener>(
  registry: Map<string, Set<Listener>>,
  resourceId: string,
  listener: Listener,
): () => void {
  let listeners = registry.get(resourceId);
  if (!listeners) {
    listeners = new Set();
    registry.set(resourceId, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) registry.delete(resourceId);
  };
}

function relayStatus(status: string): AgentConnectionStatus {
  switch (status) {
    case "connected":
      return "connected";
    case "connecting":
      return "connecting";
    case "reconnecting":
      return "reconnecting";
    default:
      return "disconnected";
  }
}
