import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dispatchDoAgent: vi.fn(),
  dispatchLoopal: vi.fn(() => false),
  onAcpMessage: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/stores/relayConnection", () => ({
  relayPool: {
    onAcpMessage: mocks.onAcpMessage,
    subscribe: mocks.subscribe,
    unsubscribe: mocks.unsubscribe,
  },
}));

vi.mock("@/stores/doagentDispatcher", () => ({
  dispatchDoAgentRelayEvent: mocks.dispatchDoAgent,
}));

vi.mock("@/stores/loopalDispatcher", () => ({
  dispatchLoopalRelayEvent: mocks.dispatchLoopal,
}));

import { useDomainControlRelay } from "./useDomainControlRelay";

describe("useDomainControlRelay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onAcpMessage.mockReturnValue(vi.fn());
  });

  it("registers the listener before subscribe can synchronously deliver events", async () => {
    const event = { goalId: "goal-1" };
    mocks.subscribe.mockImplementation(async () => {
      const listener = mocks.onAcpMessage.mock.calls[0]?.[1];
      listener(13, event);
    });

    renderHook(() => useDomainControlRelay("pod-1", "pane-1", true));

    await waitFor(() => {
      expect(mocks.dispatchDoAgent).toHaveBeenCalledWith("pod-1", 13, event);
    });
    expect(mocks.onAcpMessage).toHaveBeenCalledBefore(mocks.subscribe);
  });

  it("feeds every domain dispatcher from one subscription", async () => {
    const event = { mode: "act" };
    mocks.subscribe.mockImplementation(async () => {
      mocks.onAcpMessage.mock.calls[0]?.[1](21, event);
    });

    renderHook(() => useDomainControlRelay("pod-1", "pane-1", true));

    await waitFor(() => {
      expect(mocks.dispatchLoopal).toHaveBeenCalledWith("pod-1", 21, event);
    });
    expect(mocks.dispatchDoAgent).toHaveBeenCalledWith("pod-1", 21, event);
  });

  it("stays idle while inactive and releases the subscription on unmount", () => {
    const { unmount } = renderHook(() =>
      useDomainControlRelay("pod-1", "pane-1", false),
    );
    expect(mocks.subscribe).not.toHaveBeenCalled();
    unmount();

    mocks.subscribe.mockResolvedValue(undefined);
    const live = renderHook(() => useDomainControlRelay("pod-1", "pane-1", true));
    live.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledWith("pod-1", "domain-control-pane-1");
  });
});
