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

  it("keeps running pods interactive without a terminal control lease", () => {
    expect(
      projectPodLiveness({
        podStatus: "running",
        isPodReady: true,
        initProgress: null,
        podError: null,
        controlGranted: false,
      }),
    ).toEqual({ state: "online", readOnly: null });
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

  it("keeps cache-miss unknown readable instead of fake starting", () => {
    expect(
      projectPodLiveness({
        podStatus: "unknown",
        isPodReady: false,
        initProgress: null,
        podError: null,
        controlGranted: false,
      }),
    ).toEqual({ state: "unknown" });
  });
});
