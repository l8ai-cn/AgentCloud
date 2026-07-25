import { describe, expect, it, vi } from "vitest";

import type { AgentSessionRuntime } from "../agentSessionRuntime";
import type { WorkerTransport } from "./contracts";
import { WorkerClient } from "./WorkerClient";
import type { WorkerLiveness } from "./liveness/workerLiveness";

function fakeRuntime(sessionId: string): AgentSessionRuntime {
  return {
    open: vi.fn(async () => undefined),
    close: vi.fn(),
    getSnapshot: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
    sendMessage: vi.fn(async () => undefined),
    interrupt: vi.fn(async () => undefined),
    resolvePermission: vi.fn(async () => undefined),
    updateConfiguration: vi.fn(async () => undefined),
    loadOlder: vi.fn(async () => undefined),
  } as unknown as AgentSessionRuntime;
}

function fakeTransport(
  resolve: () => Promise<string>,
): WorkerTransport {
  return {
    kind: "pod",
    resolveSession: vi.fn(async (ref) => {
      if (ref.transport !== "pod") throw new Error("bad ref");
      return resolve();
    }),
    runtimeFor: vi.fn((sessionId) => fakeRuntime(sessionId)),
    subscribeLiveness: vi.fn(
      (_ref, listener: (liveness: WorkerLiveness) => void) => {
        listener({ state: "online", readOnly: null });
        return () => undefined;
      },
    ),
  };
}

describe("WorkerClient", () => {
  it("caches successful session resolution by ref", async () => {
    let calls = 0;
    const transport = fakeTransport(async () => {
      calls += 1;
      return "session-1";
    });
    const client = new WorkerClient();
    client.register(transport);
    const ref = { transport: "pod" as const, podKey: "pod-1" };

    await expect(client.resolveSession(ref)).resolves.toBe("session-1");
    await expect(client.resolveSession(ref)).resolves.toBe("session-1");
    expect(calls).toBe(1);
  });

  it("does not cache failed resolution", async () => {
    let calls = 0;
    const transport = fakeTransport(async () => {
      calls += 1;
      if (calls === 1) throw new Error("miss");
      return "session-1";
    });
    const client = new WorkerClient();
    client.register(transport);
    const ref = { transport: "pod" as const, podKey: "pod-1" };

    await expect(client.resolveSession(ref)).rejects.toThrow("miss");
    await expect(client.resolveSession(ref)).resolves.toBe("session-1");
    expect(calls).toBe(2);
  });
});
