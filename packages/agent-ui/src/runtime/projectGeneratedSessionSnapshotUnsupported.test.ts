import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";

import {
  ContentIdentitySchema,
  StructuredPayloadSchema,
  UnsupportedReason,
  UnsupportedValueSchema,
} from "@agent-cloud/proto/agent_workbench/v2/content_pb";

import { projectUnsupportedTimeline } from "./projectGeneratedSessionSnapshotUnsupported";

describe("projectUnsupportedTimeline", () => {
  it("recovers tool.unknown payloads into tool cards", () => {
    const payload = {
      toolCallId: "call-1",
      toolName: "Bash for i in {1..3}; do echo hi; done",
      status: "completed",
      success: true,
      resultText: "FOUND",
    };
    const value = create(UnsupportedValueSchema, {
      identity: create(ContentIdentitySchema, {
        namespace: "agentcloud.acp",
        semanticKey: "tool.unknown",
        schemaVersion: "1",
      }),
      reason: UnsupportedReason.UNKNOWN,
      payload: create(StructuredPayloadSchema, {
        mediaType: "text/plain",
        data: new TextEncoder().encode(JSON.stringify(payload)),
      }),
    });

    const items = projectUnsupportedTimeline("item-1", value);
    expect(items).toEqual([
      expect.objectContaining({
        id: "item-1",
        kind: "tool",
        title: payload.toolName,
        detail: "FOUND",
        status: "completed",
        identity: expect.objectContaining({ semanticKey: "tool.custom" }),
      }),
    ]);
  });

  it("keeps non-tool unsupported items as failed system rows", () => {
    const value = create(UnsupportedValueSchema, {
      identity: create(ContentIdentitySchema, {
        namespace: "agentcloud.acp",
        semanticKey: "timeline.future",
        schemaVersion: "1",
      }),
      reason: UnsupportedReason.UNKNOWN,
    });
    const items = projectUnsupportedTimeline("item-2", value);
    expect(items[0]).toEqual(
      expect.objectContaining({
        title: "Unsupported timeline item",
        status: "failed",
      }),
    );
  });
});
