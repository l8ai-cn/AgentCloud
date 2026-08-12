import { describe, it, expect } from "vitest";
import { filterSidebarPods } from "../podSidebarFilter";
import { SIDEBAR_STATUS_MAP, type Pod } from "../podTypes";
import { mockPod, mockPod2 } from "./pod-test-utils";

const runningPod: Pod = { ...mockPod, status: "running" };
const otherRunning: Pod = { ...mockPod2, status: "running" };
const terminatedPod: Pod = { ...mockPod, pod_key: "pod-term", status: "terminated" };
const queuedPod: Pod = { ...mockPod, pod_key: "pod-queued", status: "queued" };
const pausedPod: Pod = { ...mockPod, pod_key: "pod-paused", status: "paused" };
const erroredPod: Pod = { ...mockPod, pod_key: "pod-error", status: "error" };

function keys(pods: Pod[]): string[] {
  return pods.map((p) => p.pod_key);
}

describe("filterSidebarPods", () => {
  it("exposes exactly the two lifecycle tabs", () => {
    expect(Object.keys(SIDEBAR_STATUS_MAP).sort()).toEqual(["running", "stopped"]);
  });

  it("shows org pods regardless of creator on the running tab", () => {
    const result = filterSidebarPods([runningPod, otherRunning, terminatedPod], "running", "");
    expect(keys(result)).toEqual([runningPod.pod_key, otherRunning.pod_key]);
  });

  it("keeps queued and paused Workers on the running tab", () => {
    const result = filterSidebarPods(
      [runningPod, queuedPod, pausedPod, terminatedPod],
      "running",
      "",
    );
    expect(keys(result)).toEqual([runningPod.pod_key, queuedPod.pod_key, pausedPod.pod_key]);
  });

  it("shows only finished Workers on the stopped tab", () => {
    const result = filterSidebarPods(
      [runningPod, terminatedPod, erroredPod, queuedPod, pausedPod],
      "stopped",
      "",
    );
    expect(keys(result)).toEqual([terminatedPod.pod_key, erroredPod.pod_key]);
  });

  it("matches the search query against pod key, ticket and runner", () => {
    const ticketPod: Pod = {
      ...mockPod, pod_key: "pod-ticket", status: "running",
      ticket: { slug: "checkout-bug" },
    };
    const runnerPod: Pod = {
      ...mockPod, pod_key: "pod-runner", status: "running",
      runner: { node_id: "node-tokyo-1" },
    };
    const pods = [runningPod, ticketPod, runnerPod];

    expect(keys(filterSidebarPods(pods, "running", "CHECKOUT"))).toEqual([ticketPod.pod_key]);
    expect(keys(filterSidebarPods(pods, "running", "tokyo"))).toEqual([runnerPod.pod_key]);
    expect(keys(filterSidebarPods(pods, "running", "  "))).toEqual(keys(pods));
  });
});
