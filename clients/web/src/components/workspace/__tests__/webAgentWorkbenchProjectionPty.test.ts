import { describe, expect, it } from "vitest";

import { projectWebAgentWorkbenchSnapshot } from "../agent-ui/webAgentWorkbenchProjection";

describe("projectWebAgentWorkbenchSnapshot PTY surface", () => {
  it("keeps a host-controlled main terminal available before workbench resources land", () => {
    const snapshot = projectWebAgentWorkbenchSnapshot(
      null,
      {
        agentLabel: "Echo",
        interactionMode: "pty",
        sessionId: "conv_1",
        title: "Echo",
      },
      "connecting",
      null,
    );

    expect(snapshot.capabilities.terminal).toBe(true);
    expect(snapshot.terminals).toEqual([
      {
        controlMode: "host",
        id: "main",
        label: "main:tui",
        status: "connecting",
        writable: true,
      },
    ]);
  });

  it("does not invent a terminal for ACP sessions", () => {
    const snapshot = projectWebAgentWorkbenchSnapshot(
      null,
      {
        agentLabel: "Codex",
        interactionMode: "acp",
        sessionId: "conv_2",
        title: "Codex",
      },
      "connecting",
      null,
    );

    expect(snapshot.capabilities.terminal).toBe(false);
    expect(snapshot.terminals).toEqual([]);
  });
});
