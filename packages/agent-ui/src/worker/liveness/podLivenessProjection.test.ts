import { describe, expect, it } from "vitest";

import { projectPodLiveness } from "./podLivenessProjection";

describe("projectPodLiveness", () => {
  it("maps launch failure to unreachable", () => {
    expect(
      projectPodLiveness({
        podStatus: "error",
        isPodReady: false,
        initProgress: null,
        podError: "boom",
        controlGranted: true,
      }),
    ).toEqual({
      state: "unreachable",
      cause: { reason: "launch-failed", detail: "boom" },
      recovery: [],
    });
  });

  it("keeps completed and orphaned sessions readable", () => {
    expect(
      projectPodLiveness({
        podStatus: "orphaned",
        isPodReady: false,
        initProgress: null,
        podError: null,
        controlGranted: false,
      }),
    ).toEqual({ state: "online", readOnly: "ended" });
  });

  it("maps ready running pods to online", () => {
    expect(
      projectPodLiveness({
        podStatus: "running",
        isPodReady: true,
        initProgress: null,
        podError: null,
        controlGranted: true,
      }),
    ).toEqual({ state: "online", readOnly: null });
  });

  it("marks running pods without control as permission-read-only", () => {
    expect(
      projectPodLiveness({
        podStatus: "running",
        isPodReady: true,
        initProgress: null,
        podError: null,
        controlGranted: false,
      }),
    ).toEqual({ state: "online", readOnly: "permission" });
  });

  it("maps cold boot to starting", () => {
    expect(
      projectPodLiveness({
        podStatus: "initializing",
        isPodReady: false,
        initProgress: "Cloning workspace",
        podError: null,
        controlGranted: false,
      }),
    ).toEqual({ state: "starting", progress: "Cloning workspace" });
  });
});
