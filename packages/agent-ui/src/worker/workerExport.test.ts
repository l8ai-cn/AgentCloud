import { describe, expect, it } from "vitest";

import * as worker from "./index";

describe("worker export", () => {
  it("exposes the P1 and P2 surface", () => {
    expect(worker.WorkerClient).toBeTypeOf("function");
    expect(worker.WorkerConversation).toBeTypeOf("function");
    expect(worker.WorkerProvider).toBeTypeOf("function");
    expect(worker.projectPodLiveness).toBeTypeOf("function");
    expect(worker.projectOmnigentLiveness).toBeTypeOf("function");
    expect(worker.createOmnigentHealthPoll).toBeTypeOf("function");
    expect(worker.createOmnigentWorkerTransport).toBeTypeOf("function");
    expect(worker.buildReconnectCommand).toBeTypeOf("function");
    expect(worker.refKey({ transport: "pod", podKey: "p" })).toBe("pod:p");
  });
});
