import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OmnigentSessionMeta } from "./omnigentTransport";
import { createOmnigentWorkerTransport } from "./omnigentTransport";

function meta(overrides: Partial<OmnigentSessionMeta> = {}): OmnigentSessionMeta {
  return {
    hostId: null,
    createdAt: 0,
    labels: {},
    workspace: null,
    permissionLevel: 4,
    serverUrl: "https://example.test",
    ...overrides,
  };
}

describe("createOmnigentWorkerTransport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves omnigent refs to their session id", async () => {
    const transport = createOmnigentWorkerTransport({
      request: vi.fn(async () => Response.json({ sessions: {} })),
      getSessionMeta: () => meta(),
    });
    await expect(
      transport.resolveSession({ transport: "omnigent", sessionId: "s-1" }),
    ).resolves.toBe("s-1");
  });

  it("projects stranded after health reports runner offline", async () => {
    const request = vi.fn(async () =>
      Response.json({ sessions: { "s-1": { runner_online: false } } }),
    );
    const transport = createOmnigentWorkerTransport({
      request,
      getSessionMeta: () => meta({ createdAt: 0 }),
    });

    const seen: string[] = [];
    const stop = transport.subscribeLiveness(
      { transport: "omnigent", sessionId: "s-1" },
      (liveness) => seen.push(liveness.state),
    );

    await vi.waitFor(() => expect(seen).toContain("unreachable"));
    stop();
  });

  it("fires onRunnerOnlineEdge on rising health", async () => {
    let online = false;
    const edge = vi.fn();
    const request = vi.fn(async () =>
      Response.json({
        sessions: { "s-1": { runner_online: online } },
      }),
    );
    const transport = createOmnigentWorkerTransport({
      request,
      getSessionMeta: () => meta({ createdAt: 0 }),
      onRunnerOnlineEdge: edge,
    });

    const stop = transport.subscribeLiveness(
      { transport: "omnigent", sessionId: "s-1" },
      () => undefined,
    );
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    online = true;
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.waitFor(() => expect(edge).toHaveBeenCalledWith("s-1"));
    stop();
  });
});
