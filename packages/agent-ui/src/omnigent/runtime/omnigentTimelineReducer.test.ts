import { beforeEach, describe, expect, it } from "vitest";
import type { AgentMessageItem } from "../../contracts";
import type { OmnigentStreamEvent } from "../protocol/omnigentStreamEvents";
import { OmnigentPendingQueue } from "./omnigentPendingMessages";
import {
  appendOmnigentItem,
  createOmnigentSessionState,
} from "./omnigentSessionState";
import type { OmnigentSessionState } from "./omnigentSessionState";
import { applyOmnigentStreamEvent } from "./omnigentTimelineReducer";

const turn = (id: string) => ({
  id,
  status: "in_progress",
  model: "",
  incompleteReason: null,
  errorMessage: null,
});

describe("applyOmnigentStreamEvent", () => {
  let state: OmnigentSessionState;
  let pending: OmnigentPendingQueue;

  const apply = (...events: OmnigentStreamEvent[]): void => {
    for (const event of events) applyOmnigentStreamEvent(state, pending, event);
  };
  const messages = (): AgentMessageItem[] => state.items as AgentMessageItem[];

  beforeEach(() => {
    state = createOmnigentSessionState("conv_1");
    pending = new OmnigentPendingQueue();
  });

  it("accumulates deltas into one streaming assistant message", () => {
    apply(
      { type: "turn_started", turn: turn("resp_1") },
      { type: "text_delta", delta: "Hel" },
      { type: "text_delta", delta: "lo" },
    );

    expect(messages()).toEqual([
      expect.objectContaining({ role: "assistant", text: "Hello", status: "streaming" }),
    ]);
    expect(state.status).toBe("running");
  });

  it("rekeys the streaming placeholder onto the server item id", () => {
    apply(
      { type: "turn_started", turn: turn("resp_1") },
      { type: "text_delta", delta: "Hello" },
      {
        type: "message_item",
        itemId: "item_1",
        turnId: "resp_1",
        content: [{ type: "output_text", text: "Hello there" }],
      },
    );

    expect(messages()).toEqual([
      expect.objectContaining({ id: "item_1", text: "Hello there", status: "completed" }),
    ]);
    expect(state.streamingItemId).toBeNull();
  });

  it("does not double-render a finalized message already in the timeline", () => {
    apply({
      type: "message_item",
      itemId: "item_1",
      turnId: "resp_1",
      content: [{ type: "output_text", text: "once" }],
    });
    apply({
      type: "message_item",
      itemId: "item_1",
      turnId: "resp_1",
      content: [{ type: "output_text", text: "once" }],
    });

    expect(state.items).toHaveLength(1);
  });

  it("settles the in-flight message and clears the turn on completion", () => {
    apply(
      { type: "turn_started", turn: turn("resp_1") },
      { type: "text_delta", delta: "partial" },
      { type: "turn_completed", turn: turn("resp_1") },
    );

    expect(messages()[0].status).toBe("completed");
    expect(state.activeTurnId).toBeNull();
    expect(state.status).toBe("idle");
  });

  it("marks the message failed and surfaces the turn error", () => {
    apply(
      { type: "turn_started", turn: turn("resp_1") },
      { type: "text_delta", delta: "partial" },
      {
        type: "turn_failed",
        turn: { ...turn("resp_1"), errorMessage: "upstream exploded" },
      },
    );

    expect(messages()[0].status).toBe("failed");
    expect(state.status).toBe("failed");
    expect(state.error).toBe("upstream exploded");
  });

  it("keeps an interrupted reply in the transcript", () => {
    apply(
      { type: "turn_started", turn: turn("resp_1") },
      { type: "text_delta", delta: "half a thou" },
      { type: "session_interrupted", requestedAt: 1, turnId: "resp_1" },
    );

    expect(messages()).toEqual([
      expect.objectContaining({ text: "half a thou", status: "completed" }),
    ]);
    expect(state.activeTurnId).toBeNull();
  });

  it("scopes native streaming deltas to their vendor message id", () => {
    apply(
      { type: "text_delta", delta: "a", messageId: "m1" },
      { type: "text_delta", delta: "b", messageId: "m2" },
      { type: "text_delta", delta: "c", messageId: "m1" },
    );

    expect(messages().map((item) => item.text)).toEqual(["ac", "b"]);
  });

  it("settles a native message on its final chunk", () => {
    apply(
      { type: "text_delta", delta: "a", messageId: "m1" },
      { type: "text_delta", delta: "b", messageId: "m1", final: true },
    );

    expect(messages()[0]).toMatchObject({ text: "ab", status: "completed" });
  });

  describe("input consumption", () => {
    const consumed = (
      itemId: string,
      clearedPendingId: string | null = null,
    ): Extract<OmnigentStreamEvent, { type: "input_consumed" }> => ({
      type: "input_consumed",
      itemId,
      itemType: "message",
      isMeta: false,
      content: [{ type: "input_text", text: "hello" }],
      clearedPendingId,
    });

    const optimistic = (localId: string): void => {
      appendOmnigentItem(state, {
        id: localId,
        kind: "message",
        role: "user",
        text: "hello",
        status: "completed",
      });
      pending.enqueue(localId);
    };

    it("backfills the optimistic bubble in place rather than appending", () => {
      optimistic("local_1");
      apply(consumed("item_1"));

      expect(state.items).toHaveLength(1);
      expect(state.items[0].id).toBe("item_1");
    });

    it("claims by pending id when the transcript reorders", () => {
      optimistic("local_1");
      optimistic("local_2");
      pending.attachPendingId("local_2", "pending_b");

      apply(consumed("item_2", "pending_b"));

      expect(state.items.map((item) => item.id)).toEqual(["local_1", "item_2"]);
    });

    it("appends messages typed outside this client", () => {
      apply(consumed("item_9"));

      expect(state.items).toEqual([
        expect.objectContaining({ id: "item_9", role: "user", text: "hello" }),
      ]);
    });

    it("ignores meta items and non-message inputs", () => {
      apply({ ...consumed("item_3"), isMeta: true });
      apply({ ...consumed("item_4"), itemType: "function_call_output" });

      expect(state.items).toHaveLength(0);
    });
  });
});
