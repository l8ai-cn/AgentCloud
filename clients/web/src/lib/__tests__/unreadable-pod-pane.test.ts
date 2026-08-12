import { describe, expect, it, vi } from "vitest";

const { removePaneByPodKey } = vi.hoisted(() => ({ removePaneByPodKey: vi.fn() }));

vi.mock("@/stores/workspace", () => ({
  useWorkspaceStore: { getState: () => ({ removePaneByPodKey }) },
}));

const { ApiError } = await import("@/lib/api/api-types");
const {
  dropUnreadablePodPane,
  isPodUnreadableForever,
  unreadablePodMessage,
} = await import("../unreadable-pod-pane");

const forbidden = new Error(
  '{"kind":"http","status":403,"code":"permission_denied","message":"forbidden"}',
);
const notFound = new Error('{"kind":"resource_not_found","resource":"Pod"}');

describe("isPodUnreadableForever", () => {
  it("treats forbidden and not-found as final, from either error shape", () => {
    expect(isPodUnreadableForever(forbidden)).toBe(true);
    expect(isPodUnreadableForever(notFound)).toBe(true);
    expect(isPodUnreadableForever(new ApiError(403, "Forbidden"))).toBe(true);
    expect(isPodUnreadableForever(new ApiError(404, "Not Found"))).toBe(true);
  });

  it("leaves retryable failures alone so a starting Worker still gets polled", () => {
    expect(isPodUnreadableForever(new Error("session is not ready"))).toBe(false);
    expect(isPodUnreadableForever(new ApiError(503, "Service Unavailable"))).toBe(false);
    expect(
      isPodUnreadableForever(
        new Error('{"kind":"http","status":412,"code":"failed_precondition","message":"starting"}'),
      ),
    ).toBe(false);
  });
});

describe("unreadablePodMessage", () => {
  it("separates no-access from gone so the pane stops blaming a failed launch", () => {
    expect(unreadablePodMessage(forbidden)).toBe("No access to this Worker");
    expect(unreadablePodMessage(new ApiError(403, "Forbidden"))).toBe("No access to this Worker");
    expect(unreadablePodMessage(notFound)).toBe("Pod not found");
  });
});

describe("dropUnreadablePodPane", () => {
  it("removes the pane so a reload cannot resurrect the same rejection", () => {
    dropUnreadablePodPane("3-standalone-90f0e7e6");
    expect(removePaneByPodKey).toHaveBeenCalledWith("3-standalone-90f0e7e6");
  });
});
