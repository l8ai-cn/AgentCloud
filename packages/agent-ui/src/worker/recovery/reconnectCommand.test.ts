import { describe, expect, it } from "vitest";

import { buildReconnectCommand } from "./reconnectCommand";
import {
  isUnboundCodingFork,
  recoveryOptionsFor,
} from "./workerRecoveryOptions";
import { sessionReadOnlyReason } from "./sessionReadOnlyReason";

describe("buildReconnectCommand", () => {
  it("includes resume for stranded sessions", () => {
    const cmd = buildReconnectCommand({
      sessionId: "s-1",
      serverUrl: "https://example.test",
      wrapper: null,
    });
    expect(cmd).toContain("resume session s-1");
    expect(cmd).toContain("re-open the session from Agent Cloud web UI");
  });

  it("omits web-ui hint for claude native", () => {
    const cmd = buildReconnectCommand({
      sessionId: "s-1",
      serverUrl: "https://example.test",
      wrapper: "claude-code-native-ui",
    });
    expect(cmd).not.toContain("re-open the session");
  });
});

describe("recoveryOptionsFor", () => {
  it("builds cli + fork for stranded, plus resume-directory when unbound", () => {
    const options = recoveryOptionsFor(
      { reason: "stranded" },
      {
        sessionId: "s-1",
        serverUrl: "https://example.test",
        wrapper: null,
        isUnboundFork: true,
        sourceHostId: "host_1",
      },
    );
    expect(options.map((o) => o.kind)).toEqual([
      "cli",
      "resume-directory",
      "fork",
    ]);
  });

  it("returns wait for orphaned", () => {
    expect(
      recoveryOptionsFor({ reason: "orphaned" }, {
        sessionId: "s-1",
        serverUrl: "https://example.test",
        wrapper: null,
        isUnboundFork: false,
        sourceHostId: null,
      }),
    ).toEqual([{ kind: "wait" }]);
  });
});

describe("isUnboundCodingFork", () => {
  it("requires fork source and empty workspace", () => {
    expect(
      isUnboundCodingFork({ "agent-cloud.fork.source_id": "src" }, null),
    ).toBe(true);
    expect(
      isUnboundCodingFork({ "agent-cloud.fork.source_id": "src" }, "/ws"),
    ).toBe(false);
    expect(isUnboundCodingFork({}, null)).toBe(false);
  });
});

describe("sessionReadOnlyReason", () => {
  it("maps permission and structural labels", () => {
    expect(sessionReadOnlyReason({}, 1)).toBe("permission");
    expect(
      sessionReadOnlyReason({ "agent-cloud.closed": "true" }, 4),
    ).toBe("closed-subagent");
    expect(
      sessionReadOnlyReason(
        { "agent-cloud.wrapper": "claude-code-native-ui-subagent" },
        null,
      ),
    ).toBe("native-subagent");
  });
});
