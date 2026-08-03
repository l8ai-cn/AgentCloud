import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TerminalResource } from "@agent-cloud/agent-ui";

const relayPool = {
  subscribe: vi.fn(),
  onStatusChange: vi.fn(),
  sendResize: vi.fn(),
  acquireControl: vi.fn(),
  renewControl: vi.fn(),
  releaseControl: vi.fn(),
};

vi.mock("@/stores/workspace", () => ({ relayPool }));

const { PodTerminalRuntime } = await import(
  "../agent-ui/PodTerminalRuntime"
);

const resource: TerminalResource = {
  controlMode: "host",
  id: "main",
  label: "main:tui",
  status: "connecting",
  writable: true,
};

describe("PodTerminalRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    relayPool.onStatusChange.mockReturnValue(() => undefined);
  });

  it("streams relay output to terminal subscribers", async () => {
    let emit: ((data: Uint8Array | string) => void) | null = null;
    relayPool.subscribe.mockImplementation(
      async (_podKey, _subscriptionId, onMessage) => {
        emit = onMessage;
        return { send: vi.fn(), unsubscribe: vi.fn() };
      },
    );
    const runtime = new PodTerminalRuntime("pod-1", "workbench-desktop");
    const chunks: string[] = [];
    runtime.subscribeOutput("main", (bytes) => {
      chunks.push(new TextDecoder().decode(bytes));
    });

    await runtime.connect(resource);
    emit?.("ready$ ");
    emit?.(new TextEncoder().encode("done"));

    expect(relayPool.subscribe).toHaveBeenCalledWith(
      "pod-1",
      "workbench-desktop",
      expect.any(Function),
    );
    expect(chunks).toEqual(["ready$ ", "done"]);
  });

  it("writes keystrokes and resizes through the pod relay", async () => {
    const send = vi.fn();
    relayPool.subscribe.mockResolvedValue({ send, unsubscribe: vi.fn() });
    const runtime = new PodTerminalRuntime("pod-1", "workbench-desktop");

    await runtime.connect(resource);
    await runtime.write("main", new TextEncoder().encode("ls\r"));
    await runtime.resize("main", 120, 40);

    expect(send).toHaveBeenCalledWith("ls\r");
    expect(relayPool.sendResize).toHaveBeenCalledWith("pod-1", 120, 40);
  });

  it("mirrors relay connection status onto the terminal resource", async () => {
    relayPool.subscribe.mockResolvedValue({
      send: vi.fn(),
      unsubscribe: vi.fn(),
    });
    let publish:
      | ((info: { status: string; runnerDisconnected: boolean }) => void)
      | null = null;
    relayPool.onStatusChange.mockImplementation((_podKey, listener) => {
      publish = listener;
      return () => undefined;
    });
    const runtime = new PodTerminalRuntime("pod-1", "workbench-desktop");
    const statuses: string[] = [];
    runtime.subscribeStatus("main", (status) => statuses.push(status));

    await runtime.connect(resource);
    publish?.({ status: "none", runnerDisconnected: false });
    publish?.({ status: "connected", runnerDisconnected: false });
    publish?.({ status: "reconnecting", runnerDisconnected: true });

    expect(statuses).toEqual(["connecting", "connected", "reconnecting"]);
  });

  it("stops the relay subscription when closed", async () => {
    const unsubscribe = vi.fn();
    const stopStatus = vi.fn();
    relayPool.subscribe.mockResolvedValue({ send: vi.fn(), unsubscribe });
    relayPool.onStatusChange.mockReturnValue(stopStatus);
    const runtime = new PodTerminalRuntime("pod-1", "workbench-desktop");

    await runtime.connect(resource);
    runtime.close();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(stopStatus).toHaveBeenCalledTimes(1);
  });
});
