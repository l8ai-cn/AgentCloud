import { describe, expect, it, vi } from "vitest";
import type { WorkerLiveness } from "@agent-cloud/agent-ui";

const mocks = vi.hoisted(() => ({
  fetchPod: vi.fn(),
  removePaneByPodKey: vi.fn(),
  subscribe: vi.fn(() => () => undefined),
}));

vi.mock("@/stores/pod", () => ({
  usePodStore: {
    getState: () => ({ fetchPod: mocks.fetchPod }),
    subscribe: mocks.subscribe,
  },
}));

vi.mock("@/stores/workspace", () => ({
  useWorkspaceStore: { getState: () => ({ removePaneByPodKey: mocks.removePaneByPodKey }) },
}));

vi.mock("@/lib/wasm-core", () => ({
  getPodState: () => ({ get_pod_bytes: () => new Uint8Array() }),
  getAgentWorkbenchState: () => ({}),
}));

vi.mock("../agent-ui/resolveSessionByPodKey", () => ({
  resolveSessionByPodKey: vi.fn(),
}));

vi.mock("../agent-ui/WebAgentWorkbenchRuntime", () => ({
  WebAgentWorkbenchRuntime: class {},
}));

vi.mock("../agent-ui/webAgentWorkbenchArtifactLoader", () => ({
  createWebAgentWorkbenchArtifactLoader: () => vi.fn(),
}));

const { createPodWorkerTransport } = await import("../agent-ui/podWorkerTransport");

const options = {
  isControlGranted: () => true,
  getInitProgressMessage: () => null,
  getWorkspaceArtifactError: () => null,
};

function subscribe(podKey: string): WorkerLiveness[] {
  const seen: WorkerLiveness[] = [];
  createPodWorkerTransport(options).subscribeLiveness(
    { transport: "pod", podKey },
    (liveness) => seen.push(liveness),
  );
  return seen;
}

describe("pod transport liveness · unreadable pods", () => {
  // Regression: the poll retried eight times regardless of cause, so a pane
  // restored from another account produced eight 403s and then claimed the
  // Worker had failed to start.
  it("stops after one attempt on permission denied and reports it as forbidden", async () => {
    mocks.fetchPod.mockReset();
    mocks.removePaneByPodKey.mockReset();
    mocks.fetchPod.mockRejectedValue(
      new Error('{"kind":"http","status":403,"code":"permission_denied","message":"forbidden"}'),
    );

    const seen = subscribe("3-standalone-90f0e7e6");
    await vi.waitFor(() => {
      expect(seen.at(-1)).toEqual({
        state: "unreachable",
        cause: { reason: "forbidden" },
        recovery: [],
      });
    });

    expect(mocks.fetchPod).toHaveBeenCalledTimes(1);
    expect(mocks.removePaneByPodKey).toHaveBeenCalledWith("3-standalone-90f0e7e6");
  });

  it("keeps retrying a transient failure so a starting Worker still comes online", async () => {
    mocks.fetchPod.mockReset();
    mocks.removePaneByPodKey.mockReset();
    mocks.fetchPod
      .mockRejectedValueOnce(new Error("session is not ready"))
      .mockResolvedValueOnce(undefined);

    subscribe("5-standalone-abcd1234");

    await vi.waitFor(() => {
      expect(mocks.fetchPod).toHaveBeenCalledTimes(2);
    });
    expect(mocks.removePaneByPodKey).not.toHaveBeenCalled();
  });
});
