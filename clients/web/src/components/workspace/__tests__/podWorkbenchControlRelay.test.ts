import { beforeEach, describe, expect, it, vi } from "vitest";

const relayPool = {
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
};

vi.mock("@/stores/workspace", () => ({ relayPool }));
vi.mock("@/lib/errors/serviceError", () => ({
  isPodNotConnectable: () => false,
  isResourceNotFound: () => false,
}));

const { subscribePodWorkbenchControlRelay } = await import(
  "../agent-ui/podWorkbenchControlRelay"
);

describe("subscribePodWorkbenchControlRelay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    relayPool.subscribe.mockResolvedValue({
      send: vi.fn(),
      unsubscribe: vi.fn(),
    });
  });

  it("subscribes the pod for control-plane status and tears down cleanly", () => {
    const stop = subscribePodWorkbenchControlRelay(
      "pod-1",
      "workbench-control-desktop",
    );

    expect(relayPool.subscribe).toHaveBeenCalledWith(
      "pod-1",
      "workbench-control-desktop",
      expect.any(Function),
    );
    stop();
    expect(relayPool.unsubscribe).toHaveBeenCalledWith(
      "pod-1",
      "workbench-control-desktop",
    );
  });
});
