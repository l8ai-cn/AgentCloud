import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/stores/relayConnection", () => ({
  relayPool: {
    subscribe: mocks.subscribe,
    unsubscribe: mocks.unsubscribe,
  },
}));

import { usePodRelaySubscription } from "./usePodRelaySubscription";

describe("usePodRelaySubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subscribe.mockResolvedValue(undefined);
  });

  it("subscribes while active and releases on unmount", () => {
    const { unmount } = renderHook(() =>
      usePodRelaySubscription("pod-1", "workbench-1", true),
    );

    expect(mocks.subscribe).toHaveBeenCalledWith(
      "pod-1",
      "workbench-1",
      expect.any(Function),
    );

    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledWith("pod-1", "workbench-1");
  });

  it("stays idle while inactive", () => {
    renderHook(() => usePodRelaySubscription("pod-1", "workbench-1", false));
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  it("swallows benign lifecycle rejections", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.subscribe.mockRejectedValue(
      new Error(JSON.stringify({ kind: "resource_not_found", resource: "pod" })),
    );

    renderHook(() => usePodRelaySubscription("pod-1", "workbench-1", true));

    await waitFor(() => expect(mocks.subscribe).toHaveBeenCalled());
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
