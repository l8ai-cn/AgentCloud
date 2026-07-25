import { describe, expect, it } from "vitest";

import {
  STARTING_GRACE_S,
  projectOmnigentLiveness,
} from "./omnigentLivenessProjection";

const base = {
  hostId: null as string | null,
  createdAt: 1_700_000_000,
  runnerEverOnline: false,
  readOnly: null,
  recovery: [{ kind: "cli" as const, command: "runner run" }],
  now: () => 1_700_000_010 * 1000,
};

describe("projectOmnigentLiveness", () => {
  it("maps registered runner to online", () => {
    expect(
      projectOmnigentLiveness({ ...base, runnerOnline: true }),
    ).toEqual({ state: "online", readOnly: null });
  });

  it("uses starting grace only before first online observation", () => {
    expect(
      projectOmnigentLiveness({ ...base, runnerOnline: false }),
    ).toEqual({ state: "starting", progress: null });

    expect(
      projectOmnigentLiveness({
        ...base,
        runnerOnline: false,
        runnerEverOnline: true,
      }),
    ).toEqual({
      state: "unreachable",
      cause: { reason: "stranded" },
      recovery: base.recovery,
    });
  });

  it("expires starting grace after STARTING_GRACE_S", () => {
    expect(
      projectOmnigentLiveness({
        ...base,
        runnerOnline: false,
        now: () => (base.createdAt + STARTING_GRACE_S + 1) * 1000,
      }),
    ).toEqual({
      state: "unreachable",
      cause: { reason: "stranded" },
      recovery: base.recovery,
    });
  });

  it("stays unknown before the first poll", () => {
    expect(
      projectOmnigentLiveness({
        ...base,
        runnerOnline: undefined,
        createdAt: 0,
      }),
    ).toEqual({ state: "unknown" });
  });

  it("does not strand host-bound sessions without host signal", () => {
    expect(
      projectOmnigentLiveness({
        ...base,
        runnerOnline: false,
        runnerEverOnline: true,
        hostId: "host_abc",
      }),
    ).toEqual({ state: "unknown" });
  });
});
