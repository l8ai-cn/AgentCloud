import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";

import { ContentBlockSchema } from "@agent-cloud/proto/agent_workbench/v2/content_pb";
import {
  SessionSnapshotSchema,
  SystemTimelineItemSchema,
  TimelineItemContentSchema,
  TimelineItemSchema,
} from "@agent-cloud/proto/agent_workbench/v2/session_pb";
import { SessionStatus } from "@agent-cloud/proto/agent_workbench/v2/session_state_pb";

import { projectGeneratedSessionSnapshot } from "./projectGeneratedSessionSnapshot";

describe("projectGeneratedSessionSnapshot system logs", () => {
  it("drops stderr bootstrap and persist noise from the conversation", () => {
    const snapshot = create(SessionSnapshotSchema, {
      sessionId: "session-logs",
      streamEpoch: "epoch-logs",
      revision: 1n,
      latestSequence: 3n,
      status: SessionStatus.IDLE,
      history: [
        systemLogItem("log-stderr", 1n, "stderr", "[Persist] No database connection available"),
        systemLogItem("log-info", 2n, "info", "[Restore] Attempting to restore session"),
        systemLogItem("log-error", 3n, "error", "provider rejected credentials"),
      ],
    });

    const projected = projectGeneratedSessionSnapshot(snapshot, {
      title: "Quiet conversation",
      agentLabel: "DoAgent",
      connection: "connected",
      interactionMode: "acp",
      hasOlderItems: false,
    });

    expect(projected.items).toEqual([
      expect.objectContaining({
        id: "log-error",
        kind: "system",
        detail: "[error] provider rejected credentials",
      }),
    ]);
    expect(projected.items.map((item) => item.id)).not.toContain("log-stderr");
    expect(projected.items.map((item) => item.id)).not.toContain("log-info");
  });
});

function systemLogItem(
  itemId: string,
  sequence: bigint,
  level: string,
  message: string,
) {
  return create(TimelineItemSchema, {
    envelope: {
      sessionId: "session-logs",
      streamEpoch: "epoch-logs",
      revision: 1n,
      sequence,
      itemId,
    },
    content: create(TimelineItemContentSchema, {
      content: {
        case: "system",
        value: create(SystemTimelineItemSchema, {
          content: [
            create(ContentBlockSchema, {
              contentId: `${itemId}:log`,
              content: {
                case: "log",
                value: { level, message },
              },
            }),
          ],
        }),
      },
    }),
  });
}
