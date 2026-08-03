import { describe, it, expect, beforeEach, vi } from "vitest";
import { act } from "@testing-library/react";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";
import { ListPodsRequestSchema, ListPodsResponseSchema, PodSchema } from "@proto/pod/v1/pod_pb";
import { usePodStore, SIDEBAR_STATUS_MAP, Pod } from "../pod";
import { getPodService } from "@/lib/wasm-core";
import {
  mockPod,
  mockPod2,
  resetPodStore,
  seedPods,
  readPods,
  podStateMock,
  lastAppendCachedPods,
} from "./pod-test-utils";

interface MockService {
  list_pods_connect: ReturnType<typeof vi.fn>;
}

function svc(): MockService {
  return getPodService() as unknown as MockService;
}

function encodePods(pods: unknown[], total: number) {
  const items = pods.map((p) =>
    create(PodSchema, {
      id: BigInt((p as { id: number }).id),
      podKey: (p as { pod_key: string }).pod_key,
      status: (p as { status: string }).status,
      agentStatus: (p as { agent_status?: string }).agent_status ?? "",
      createdAt: (p as { created_at?: string }).created_at ?? "",
    }),
  );
  const resp = create(ListPodsResponseSchema, { items, total: BigInt(total), limit: 0, offset: 0 });
  return toBinary(ListPodsResponseSchema, resp);
}

function mockSidebar(pods: unknown[], total: number) {
  vi.mocked(svc().list_pods_connect).mockResolvedValue(encodePods(pods, total));
}

function mockLoadMore(newPods: unknown[], total: number) {
  vi.mocked(svc().list_pods_connect).mockResolvedValue(encodePods(newPods, total));
}

describe("Pod Store — defaults", () => {
  it("should default currentSidebarFilter to running", () => {
    expect(SIDEBAR_STATUS_MAP).toHaveProperty("running");
    expect(SIDEBAR_STATUS_MAP).toHaveProperty("stopped");
    expect(SIDEBAR_STATUS_MAP).not.toHaveProperty("mine");
    expect(SIDEBAR_STATUS_MAP).not.toHaveProperty("all");
  });

  it("should have running as default currentSidebarFilter after reset", async () => {
    await resetPodStore();
    expect(usePodStore.getState().currentSidebarFilter).toBe("running");
  });
});

describe("Pod Store — SIDEBAR_STATUS_MAP client-side guard", () => {
  function applyClientFilter(pods: Pod[], filter: string): Pod[] {
    const allowedStatuses = SIDEBAR_STATUS_MAP[filter];
    const statusSet = allowedStatuses
      ? new Set(allowedStatuses.split(","))
      : null;

    return pods.filter((pod) => {
      if (statusSet && !statusSet.has(pod.status)) return false;
      return true;
    });
  }

  const runningPod: Pod = { ...mockPod, status: "running" };
  const otherRunning: Pod = { ...mockPod2, status: "running" };
  const terminatedPod: Pod = { ...mockPod, pod_key: "pod-term", status: "terminated" };

  it("running filter shows org pods regardless of creator", () => {
    const result = applyClientFilter([runningPod, otherRunning, terminatedPod], "running");
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.pod_key)).toEqual([runningPod.pod_key, otherRunning.pod_key]);
  });

  it("stopped filter should only show terminal status pods", () => {
    const failedPod: Pod = {
      ...mockPod,
      pod_key: "pod-failed",
      status: "failed",
      agent_status: "idle",
      created_at: "2024-01-03T00:00:00Z",
    };
    const result = applyClientFilter([runningPod, terminatedPod, failedPod], "stopped");
    expect(result).toHaveLength(2);
  });
});

describe("Pod Store — fetchSidebarPods", () => {
  beforeEach(resetPodStore);

  it("should call list_pods_connect for running filter", async () => {
    mockSidebar([mockPod], 1);

    await act(async () => {
      await usePodStore.getState().fetchSidebarPods("running");
    });

    expect(svc().list_pods_connect).toHaveBeenCalled();
    expect(usePodStore.getState().currentSidebarFilter).toBe("running");
  });

  it("should call list_pods_connect for stopped filter", async () => {
    mockSidebar([], 0);

    await act(async () => {
      await usePodStore.getState().fetchSidebarPods("stopped");
    });

    expect(svc().list_pods_connect).toHaveBeenCalled();
  });

  it("should set loading during fetch and clear after", async () => {
    let loadingDuringFetch = false;
    vi.mocked(svc().list_pods_connect).mockImplementation(async () => {
      loadingDuringFetch = usePodStore.getState().loading;
      return encodePods([], 0);
    });

    await act(async () => {
      await usePodStore.getState().fetchSidebarPods("running");
    });

    expect(loadingDuringFetch).toBe(true);
    expect(usePodStore.getState().loading).toBe(false);
  });

  it("should NOT flip loading during a silent refresh but still hit the network", async () => {
    usePodStore.setState({ currentSidebarFilter: "running" });
    let loadingDuringFetch = false;
    vi.mocked(svc().list_pods_connect).mockImplementation(async () => {
      loadingDuringFetch = usePodStore.getState().loading;
      return encodePods([mockPod], 1);
    });

    await act(async () => {
      await usePodStore.getState().fetchSidebarPods("running", { silent: true });
    });

    expect(loadingDuringFetch).toBe(false);
    expect(svc().list_pods_connect).toHaveBeenCalled();
    expect(usePodStore.getState().loading).toBe(false);
  });

  it("silent refresh updates data without flipping loading or filter", async () => {
    usePodStore.setState({ currentSidebarFilter: "running" });
    mockSidebar([mockPod], 5);

    await act(async () => {
      await usePodStore.getState().fetchSidebarPods("running", { silent: true });
    });

    expect(usePodStore.getState().currentSidebarFilter).toBe("running");
    expect(usePodStore.getState().podTotal).toBe(5);
    expect(usePodStore.getState().podHasMore).toBe(true);
    expect(usePodStore.getState().loading).toBe(false);
  });

  it("should discard a stale page when the filter changes mid-flight", async () => {
    usePodStore.setState({ currentSidebarFilter: "running" });
    vi.mocked(svc().list_pods_connect).mockImplementation(async () => {
      usePodStore.setState({ currentSidebarFilter: "stopped" });
      return encodePods([mockPod], 5);
    });

    await act(async () => {
      await usePodStore.getState().fetchSidebarPods("running", { silent: true });
    });

    expect(podStateMock().apply_fetched_pods).not.toHaveBeenCalled();
    expect(usePodStore.getState().podTotal).not.toBe(5);
  });

  it("silent refresh failure should preserve existing error, loading, and list", async () => {
    usePodStore.setState({ currentSidebarFilter: "running" });
    seedPods(mockPod);
    usePodStore.setState({ error: "stale error", loading: false });
    vi.mocked(svc().list_pods_connect).mockRejectedValue(new Error("network down"));

    await act(async () => {
      await usePodStore.getState().fetchSidebarPods("running", { silent: true });
    });

    expect(usePodStore.getState().error).toBe("stale error");
    expect(usePodStore.getState().loading).toBe(false);
    expect(podStateMock().apply_fetched_pods).not.toHaveBeenCalled();
    expect(readPods()).toHaveLength(1);
  });

  it("should compute podHasMore correctly", async () => {
    mockSidebar([mockPod], 5);

    await act(async () => {
      await usePodStore.getState().fetchSidebarPods("running");
    });

    expect(usePodStore.getState().podHasMore).toBe(true);
    expect(usePodStore.getState().podTotal).toBe(5);
  });

  it("should handle error and clear loading", async () => {
    vi.mocked(svc().list_pods_connect).mockRejectedValue(new Error("Network error"));

    await act(async () => {
      await usePodStore.getState().fetchSidebarPods("running");
    });

    expect(usePodStore.getState().error).toBe("Network error");
    expect(usePodStore.getState().loading).toBe(false);
  });
});

describe("Pod Store — loadMorePods", () => {
  beforeEach(resetPodStore);

  it("should page from sidebarLoadedCount, not the realtime-polluted cache length", async () => {
    seedPods(mockPod, mockPod2);
    usePodStore.setState({ podHasMore: true, currentSidebarFilter: "running", sidebarLoadedCount: 1 });
    let capturedOffset = -1;
    vi.mocked(svc().list_pods_connect).mockImplementation(async (bytes: unknown) => {
      capturedOffset = Number(fromBinary(ListPodsRequestSchema, bytes as Uint8Array).offset);
      return encodePods([mockPod2], 2);
    });

    await act(async () => {
      await usePodStore.getState().loadMorePods();
    });

    expect(svc().list_pods_connect).toHaveBeenCalled();
    expect(capturedOffset).toBe(1);
    const appended = lastAppendCachedPods();
    expect(appended[0].pod_key).toBe(mockPod2.pod_key);
  });

  it("should skip when no more pods", async () => {
    seedPods(mockPod);
    usePodStore.setState({ podHasMore: false });

    await act(async () => {
      await usePodStore.getState().loadMorePods();
    });

    expect(svc().list_pods_connect).not.toHaveBeenCalled();
  });

  it("should skip when already loading more", async () => {
    seedPods(mockPod);
    usePodStore.setState({ podHasMore: true, loadingMore: true });

    await act(async () => {
      await usePodStore.getState().loadMorePods();
    });

    expect(svc().list_pods_connect).not.toHaveBeenCalled();
  });

  it("should deduplicate pods already in list (upsert by pod_key)", async () => {
    seedPods(mockPod, mockPod2);
    usePodStore.setState({ podHasMore: true, currentSidebarFilter: "running" });
    mockLoadMore([mockPod2], 3);

    await act(async () => {
      await usePodStore.getState().loadMorePods();
    });

    expect(svc().list_pods_connect).toHaveBeenCalled();
    const appended = lastAppendCachedPods();
    expect(appended.map((p) => p.pod_key)).toEqual([mockPod2.pod_key]);
  });

  it("should advance sidebarLoadedCount and recompute hasMore from it", async () => {
    usePodStore.setState({ podHasMore: true, currentSidebarFilter: "running", sidebarLoadedCount: 20 });
    mockLoadMore([mockPod, mockPod2], 25);

    await act(async () => {
      await usePodStore.getState().loadMorePods();
    });

    expect(usePodStore.getState().sidebarLoadedCount).toBe(22);
    expect(usePodStore.getState().podHasMore).toBe(true);

    mockLoadMore(
      [{ ...mockPod, id: 23, pod_key: "p23" }, { ...mockPod, id: 24, pod_key: "p24" }, { ...mockPod, id: 25, pod_key: "p25" }],
      25,
    );

    await act(async () => {
      await usePodStore.getState().loadMorePods();
    });

    expect(usePodStore.getState().sidebarLoadedCount).toBe(25);
    expect(usePodStore.getState().podHasMore).toBe(false);
  });
});

describe("Pod Store — sidebar fetch/loadMore out-of-order guards", () => {
  beforeEach(resetPodStore);

  it("a slower stale same-filter fetch must not clobber a newer one's cache + total", async () => {
    usePodStore.setState({ currentSidebarFilter: "running" });
    let resolveSlow: ((b: Uint8Array) => void) | undefined;
    const slow = new Promise<Uint8Array>((r) => { resolveSlow = r; });
    vi.mocked(svc().list_pods_connect)
      .mockReturnValueOnce(slow as unknown as Promise<Uint8Array>)
      .mockResolvedValueOnce(encodePods([mockPod2], 99));

    const pSlow = usePodStore.getState().fetchSidebarPods("running", { silent: true });
    const pFast = usePodStore.getState().fetchSidebarPods("running", { silent: true });
    await act(async () => { await pFast; });

    expect(usePodStore.getState().podTotal).toBe(99);
    const replaceCalls = podStateMock().apply_fetched_pods.mock.calls.length;

    resolveSlow!(encodePods([mockPod], 1));
    await act(async () => { await pSlow; });

    expect(usePodStore.getState().podTotal).toBe(99);
    expect(podStateMock().apply_fetched_pods.mock.calls.length).toBe(replaceCalls);
  });

  it("a non-silent cold load superseded by a silent refresh still clears loading", async () => {
    let resolveCold: ((b: Uint8Array) => void) | undefined;
    const coldSlow = new Promise<Uint8Array>((r) => { resolveCold = r; });
    vi.mocked(svc().list_pods_connect)
      .mockReturnValueOnce(coldSlow as unknown as Promise<Uint8Array>)
      .mockResolvedValueOnce(encodePods([mockPod], 1));

    const pCold = usePodStore.getState().fetchSidebarPods("running");
    const pSilent = usePodStore.getState().fetchSidebarPods("running", { silent: true });
    await act(async () => {
      await pSilent;
    });

    expect(usePodStore.getState().loading).toBe(true);

    resolveCold!(encodePods([mockPod2], 2));
    await act(async () => {
      await pCold;
    });

    expect(usePodStore.getState().loading).toBe(false);
  });

  it("loadMorePods discards its page when a fetchSidebarPods supersedes it mid-flight", async () => {
    usePodStore.setState({ podHasMore: true, currentSidebarFilter: "running", sidebarLoadedCount: 20 });
    let resolveLoadMore: ((b: Uint8Array) => void) | undefined;
    const loadMoreSlow = new Promise<Uint8Array>((r) => { resolveLoadMore = r; });
    vi.mocked(svc().list_pods_connect)
      .mockReturnValueOnce(loadMoreSlow as unknown as Promise<Uint8Array>)
      .mockResolvedValueOnce(encodePods([mockPod], 5));

    const pLoadMore = usePodStore.getState().loadMorePods();
    const pFetch = usePodStore.getState().fetchSidebarPods("running", { silent: true });
    await act(async () => {
      await pFetch;
    });

    const appendsBefore = podStateMock().apply_appended_pods.mock.calls.length;
    resolveLoadMore!(encodePods([mockPod2], 99));
    await act(async () => {
      await pLoadMore;
    });

    expect(podStateMock().apply_appended_pods.mock.calls.length).toBe(appendsBefore);
    expect(usePodStore.getState().loadingMore).toBe(false);
    expect(usePodStore.getState().podTotal).not.toBe(99);
  });

  it("loadMorePods discards when a fetchSidebarPods was ALREADY in flight at start (same seq baseline)", async () => {
    usePodStore.setState({ podHasMore: true, currentSidebarFilter: "running", sidebarLoadedCount: 40 });
    let resolveFetch: ((b: Uint8Array) => void) | undefined;
    const fetchSlow = new Promise<Uint8Array>((r) => { resolveFetch = r; });
    let resolveLoadMore: ((b: Uint8Array) => void) | undefined;
    const loadMoreSlow = new Promise<Uint8Array>((r) => { resolveLoadMore = r; });
    vi.mocked(svc().list_pods_connect)
      .mockReturnValueOnce(fetchSlow as unknown as Promise<Uint8Array>)
      .mockReturnValueOnce(loadMoreSlow as unknown as Promise<Uint8Array>);

    const pFetch = usePodStore.getState().fetchSidebarPods("running", { silent: true });
    const pLoadMore = usePodStore.getState().loadMorePods();

    resolveFetch!(encodePods([mockPod], 99));
    await act(async () => { await pFetch; });
    const appendsBefore = podStateMock().apply_appended_pods.mock.calls.length;

    resolveLoadMore!(encodePods([mockPod2], 99));
    await act(async () => { await pLoadMore; });
    expect(podStateMock().apply_appended_pods.mock.calls.length).toBe(appendsBefore);
  });
});
