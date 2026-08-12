import { describe, expect, it } from "vitest";

import {
  POD_STATUSES,
  isPodActive,
  isPodFinished,
  isPodRelayConnectable,
  isPodResumableSource,
  isPodTerminal,
} from "./pod-status";

describe("pod-status", () => {
  it.each(["queued", "initializing", "running", "paused", "disconnected"])(
    "treats %s as active",
    (status) => {
      expect(isPodActive(status)).toBe(true);
    },
  );

  it.each(["running", "paused", "disconnected"])(
    "treats %s as relay-connectable",
    (status) => {
      expect(isPodRelayConnectable(status)).toBe(true);
    },
  );

  it.each(["queued", "initializing", "terminated", "completed", "error"])(
    "rejects %s for relay connect",
    (status) => {
      expect(isPodRelayConnectable(status)).toBe(false);
    },
  );

  // Wake forks a new pod from a stopped one; the backend accepts exactly these
  // three as `source_pod_key` (pod_orchestrator_resume.go), and orphaned used to
  // be missing from the UI so those Workers could never be woken.
  it.each(["terminated", "completed", "orphaned"])(
    "offers wake for %s",
    (status) => {
      expect(isPodResumableSource(status)).toBe(true);
    },
  );

  it("does not offer wake for error — the failure cause is unresolved", () => {
    expect(isPodResumableSource("error")).toBe(false);
  });

  it("splits every status into exactly one of active / finished", () => {
    for (const status of POD_STATUSES) {
      expect(isPodActive(status)).toBe(!isPodFinished(status));
    }
  });

  it("has no phantom statuses", () => {
    expect(POD_STATUSES).not.toContain("failed");
    expect(isPodActive("failed")).toBe(false);
    expect(isPodFinished("failed")).toBe(false);
  });

  it("counts completed as finished but not terminal", () => {
    expect(isPodFinished("completed")).toBe(true);
    expect(isPodTerminal("completed")).toBe(false);
  });
});
