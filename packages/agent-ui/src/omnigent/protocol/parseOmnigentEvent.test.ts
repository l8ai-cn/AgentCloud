import { describe, expect, it } from "vitest";
import { parseOmnigentEvent } from "./parseOmnigentEvent";

describe("parseOmnigentEvent", () => {
  it("lifts turn lifecycle from either envelope shape", () => {
    expect(parseOmnigentEvent("turn.started", { id: "resp_1", status: "in_progress" })).toEqual({
      type: "turn_started",
      turn: {
        id: "resp_1",
        status: "in_progress",
        model: "",
        incompleteReason: null,
        errorMessage: null,
      },
    });

    expect(
      parseOmnigentEvent("turn.completed", { response: { id: "resp_2", status: "completed" } }),
    ).toMatchObject({ type: "turn_completed", turn: { id: "resp_2" } });
  });

  it("surfaces the incomplete reason a user interrupt carries", () => {
    expect(
      parseOmnigentEvent("response.incomplete", {
        id: "resp_3",
        incomplete_details: { reason: "user_interrupt" },
      }),
    ).toMatchObject({ type: "turn_incomplete", reason: "user_interrupt" });
  });

  it("keeps native streaming fields off the event when absent", () => {
    expect(parseOmnigentEvent("turn.text.delta", { delta: "hi" })).toEqual({
      type: "text_delta",
      delta: "hi",
    });

    expect(
      parseOmnigentEvent("turn.text.delta", { delta: "hi", message_id: "m1", index: 2, final: true }),
    ).toEqual({ type: "text_delta", delta: "hi", messageId: "m1", index: 2, final: true });
  });

  it("rejects a delta with no string payload", () => {
    expect(parseOmnigentEvent("turn.text.delta", { delta: 7 })).toBeNull();
  });

  it("reads finalized assistant messages and skips meta ones", () => {
    expect(
      parseOmnigentEvent("turn.item.done", {
        item: {
          id: "item_1",
          type: "message",
          response_id: "resp_1",
          content: [{ type: "output_text", text: "done" }],
        },
      }),
    ).toEqual({
      type: "message_item",
      itemId: "item_1",
      turnId: "resp_1",
      content: [{ type: "output_text", text: "done" }],
    });

    expect(
      parseOmnigentEvent("turn.item.done", {
        item: { id: "item_2", type: "message", is_meta: true, content: [] },
      }),
    ).toBeNull();
  });

  it("ignores item kinds no feature reduces yet", () => {
    expect(
      parseOmnigentEvent("turn.item.done", { item: { id: "i", type: "function_call" } }),
    ).toBeNull();
  });

  it("validates session status against the known set", () => {
    expect(
      parseOmnigentEvent("session.status", { conversation_id: "c1", status: "running" }),
    ).toEqual({ type: "session_status", sessionId: "c1", status: "running" });

    expect(
      parseOmnigentEvent("session.status", { conversation_id: "c1", status: "bogus" }),
    ).toBeNull();
    expect(parseOmnigentEvent("session.status", { status: "running" })).toBeNull();
  });

  it("unwraps the nested envelope input consumption uses", () => {
    expect(
      parseOmnigentEvent("session.input.consumed", {
        data: {
          item_id: "item_9",
          type: "message",
          created_by: "dev@example.com",
          cleared_pending_id: "pending_a1",
          data: { content: [{ type: "input_text", text: "hello" }] },
        },
      }),
    ).toEqual({
      type: "input_consumed",
      itemId: "item_9",
      itemType: "message",
      isMeta: false,
      createdBy: "dev@example.com",
      content: [{ type: "input_text", text: "hello" }],
      clearedPendingId: "pending_a1",
    });
  });

  it("treats a flat input-consumed envelope as malformed", () => {
    expect(
      parseOmnigentEvent("session.input.consumed", { item_id: "x", type: "message" }),
    ).toBeNull();
  });

  it("skips heartbeats and unmodelled events", () => {
    expect(parseOmnigentEvent("response.heartbeat", {})).toBeNull();
    expect(parseOmnigentEvent("session.todos", { conversation_id: "c1" })).toBeNull();
  });
});
