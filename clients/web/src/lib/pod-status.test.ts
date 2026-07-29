import { describe, expect, it } from "vitest";

import { isPodActive, isPodRelayConnectable } from "./pod-status";

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
});
