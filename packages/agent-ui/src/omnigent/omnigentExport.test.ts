import { describe, expect, it } from "vitest";

import {
  OmnigentApiError,
  OmnigentSessionRuntime,
  omnigentFrameScheduler,
  omnigentSyncScheduler,
} from "@agent-cloud/agent-ui/omnigent";

describe("omnigent package export", () => {
  it("exposes the runtime, its schedulers, and the transport error", () => {
    expect(OmnigentSessionRuntime).toBeTypeOf("function");
    expect(omnigentFrameScheduler).toBeTypeOf("function");
    expect(omnigentSyncScheduler).toBeTypeOf("function");
    expect(OmnigentApiError).toBeTypeOf("function");
  });

  it("satisfies the shared session runtime contract", () => {
    const runtime = new OmnigentSessionRuntime({
      request: () => Promise.reject(new Error("unused")),
    });
    for (const method of [
      "open",
      "close",
      "getSnapshot",
      "subscribe",
      "sendMessage",
      "interrupt",
      "loadOlder",
    ] as const) {
      expect(runtime[method]).toBeTypeOf("function");
    }
  });
});
