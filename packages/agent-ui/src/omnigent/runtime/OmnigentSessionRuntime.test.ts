import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentMessageItem } from "../../contracts";
import {
  OmnigentTestServer,
  assistantItem,
  userItem,
} from "../omnigentTestServer";
import { OmnigentSessionRuntime } from "./OmnigentSessionRuntime";
import { omnigentSyncScheduler } from "./omnigentNotifyScheduler";

const SESSION = "conv_1";

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("waitFor timed out");
}

describe("OmnigentSessionRuntime", () => {
  let server: OmnigentTestServer;
  let runtime: OmnigentSessionRuntime;

  const texts = (): string[] =>
    runtime
      .getSnapshot(SESSION)
      .items.map((item) => (item as AgentMessageItem).text);

  beforeEach(() => {
    server = new OmnigentTestServer();
    runtime = new OmnigentSessionRuntime({
      request: server.fetch,
      scheduler: omnigentSyncScheduler,
      random: () => 0,
    });
  });

  afterEach(() => {
    runtime.close(SESSION);
  });

  it("hydrates metadata and the opening history window", async () => {
    server.session.title = "Ship it";
    server.items = [userItem("i1", "hello"), assistantItem("i2", "hi back")];

    await runtime.open(SESSION);

    const snapshot = runtime.getSnapshot(SESSION);
    expect(snapshot.title).toBe("Ship it");
    expect(snapshot.agentLabel).toBe("Coder");
    expect(snapshot.hasOlderItems).toBe(false);
    expect(texts()).toEqual(["hello", "hi back"]);
  });

  it("reports older history when the server has more pages", async () => {
    server.items = Array.from({ length: 45 }, (_, index) =>
      userItem(`i${index}`, `m${index}`),
    );

    await runtime.open(SESSION);

    expect(runtime.getSnapshot(SESSION).hasOlderItems).toBe(true);
    await runtime.loadOlder(SESSION);
    expect(runtime.getSnapshot(SESSION).items.length).toBeGreaterThan(20);
  });

  it("subscribes the live tail before awaiting hydration", async () => {
    server.pauseHistory();
    server.items = [userItem("i1", "from history")];

    const opening = runtime.open(SESSION);
    await waitFor(() => server.streamOpen);

    // Events emitted during the hydration window must land, not be dropped.
    server.emit("turn.started", { id: "resp_1" });
    server.emit("turn.text.delta", { delta: "live" });
    server.resumeHistory();
    await opening;

    expect(texts()).toEqual(["from history", "live"]);
  });

  it("does not double-render an item delivered by both stream and history", async () => {
    server.pauseHistory();
    server.items = [userItem("i1", "hello")];

    const opening = runtime.open(SESSION);
    await waitFor(() => server.streamOpen);
    server.emit("session.input.consumed", {
      data: {
        item_id: "i1",
        type: "message",
        data: { content: [{ type: "input_text", text: "hello" }] },
      },
    });
    server.resumeHistory();
    await opening;

    expect(texts()).toEqual(["hello"]);
  });

  describe("sending", () => {
    beforeEach(async () => {
      await runtime.open(SESSION);
    });

    it("shows the bubble optimistically and posts the message", async () => {
      server.eventReceipt = { queued: true, item_id: "item_7" };

      await runtime.sendMessage(SESSION, "cmd_1", { text: "do the thing" });

      expect(texts()).toEqual(["do the thing"]);
      expect(server.postedEvents).toEqual([
        { type: "message", data: { content: [{ type: "input_text", text: "do the thing" }] } },
      ]);
      expect(runtime.getSnapshot(SESSION).items[0].id).toBe("item_7");
    });

    it("settles the optimistic bubble against a later consumption event", async () => {
      await runtime.sendMessage(SESSION, "cmd_1", { text: "queued" });
      server.emit("session.input.consumed", {
        data: {
          item_id: "item_8",
          type: "message",
          data: { content: [{ type: "input_text", text: "queued" }] },
        },
      });
      await waitFor(() => runtime.getSnapshot(SESSION).items[0]?.id === "item_8");

      expect(texts()).toEqual(["queued"]);
    });

    it("claims by pending id on a native-terminal round trip", async () => {
      server.eventReceipt = { queued: true, pending_id: "pending_a1" };
      await runtime.sendMessage(SESSION, "cmd_1", { text: "via terminal" });

      server.emit("session.input.consumed", {
        data: {
          item_id: "item_9",
          type: "message",
          cleared_pending_id: "pending_a1",
          data: { content: [{ type: "input_text", text: "via terminal" }] },
        },
      });
      await waitFor(() => runtime.getSnapshot(SESSION).items[0]?.id === "item_9");

      expect(runtime.getSnapshot(SESSION).items).toHaveLength(1);
    });

    it("marks the bubble failed when a policy denies the input", async () => {
      server.eventReceipt = { queued: false, denied: true };
      await runtime.sendMessage(SESSION, "cmd_1", { text: "blocked" });

      expect(runtime.getSnapshot(SESSION).items[0]).toMatchObject({
        text: "blocked",
        status: "failed",
      });
    });

    it("withdraws the bubble when the post itself fails", async () => {
      const failing = new OmnigentSessionRuntime({
        request: () => Promise.reject(new Error("offline")),
        scheduler: omnigentSyncScheduler,
      });
      await failing.open("conv_2");

      await expect(
        failing.sendMessage("conv_2", "cmd_1", { text: "lost" }),
      ).rejects.toThrow("offline");
      expect(failing.getSnapshot("conv_2").items).toHaveLength(0);
      failing.close("conv_2");
    });
  });

  it("interrupts and keeps the partial reply", async () => {
    await runtime.open(SESSION);
    server.emit("turn.started", { id: "resp_1" });
    server.emit("turn.text.delta", { delta: "thinking out lo" });
    await waitFor(() => texts().length === 1);

    await runtime.interrupt(SESSION);
    server.emit("session.interrupted", { data: { requested_at: 1 } });
    await waitFor(
      () =>
        (runtime.getSnapshot(SESSION).items[0] as AgentMessageItem).status ===
        "completed",
    );

    expect(server.postedEvents).toContainEqual({ type: "interrupt", data: {} });
    expect(texts()).toEqual(["thinking out lo"]);
  });

  it("splices in items committed while the socket was dead", async () => {
    server.items = [userItem("i1", "before")];
    await runtime.open(SESSION);
    await waitFor(() => server.streamOpen);

    server.items = [
      userItem("i1", "before"),
      assistantItem("i2", "during outage"),
      userItem("i3", "also during"),
    ];
    server.dropStream();

    await waitFor(() => texts().length === 3);
    expect(texts()).toEqual(["before", "during outage", "also during"]);
    expect(server.streamOpenCount).toBeGreaterThan(1);
  });

  it("backs off across consecutive failed opens, then connects", async () => {
    server.failNextStreamOpens = 2;
    await runtime.open(SESSION);

    await waitFor(() => runtime.getSnapshot(SESSION).connection === "connected");
    expect(server.streamOpenCount).toBe(3);
  });

  it("stops reconnecting after the server's done sentinel", async () => {
    await runtime.open(SESSION);
    await waitFor(() => server.streamOpen);
    server.emitDone();

    await waitFor(
      () => runtime.getSnapshot(SESSION).connection === "disconnected",
    );
    const opens = server.streamOpenCount;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(server.streamOpenCount).toBe(opens);
  });
});
