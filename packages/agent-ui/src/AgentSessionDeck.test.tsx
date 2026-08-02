import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { AgentSessionDeck, type AgentSessionDeckEntry } from "./AgentSessionDeck";
import {
  agentWorkspaceRuntime as runtime,
  agentWorkspaceSnapshot as sessionSnapshot,
} from "./AgentWorkspace.test-fixture";

function deckEntry(sessionId: string, title: string): AgentSessionDeckEntry {
  const snapshot = sessionSnapshot();
  snapshot.sessionId = sessionId;
  snapshot.title = title;
  snapshot.status = "idle";
  snapshot.items = [];
  snapshot.plan = [];
  snapshot.permissions = [];
  return {
    runtime: runtime(snapshot).agentRuntime,
    sessionId,
  };
}

function workspaceOf(sessionId: string) {
  return document.querySelector(`[data-agent-workspace="${sessionId}"]`);
}

describe("AgentSessionDeck", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:artifact"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("renders one tab per session and mounts only the active session", async () => {
    render(
      <AgentSessionDeck
        sessions={[deckEntry("session-1", "Release audit"), deckEntry("session-2", "Docs sweep")]}
      />,
    );

    expect(await screen.findByRole("tab", { name: "Release audit" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Docs sweep" })).toBeVisible();
    expect(workspaceOf("session-1")).not.toBeNull();
    expect(workspaceOf("session-2")).toBeNull();
  });

  it("switches sessions while keeping visited sessions mounted", async () => {
    const onActiveSessionChange = vi.fn();
    render(
      <AgentSessionDeck
        onActiveSessionChange={onActiveSessionChange}
        sessions={[deckEntry("session-1", "Release audit"), deckEntry("session-2", "Docs sweep")]}
      />,
    );
    await screen.findByRole("tab", { name: "Release audit" });

    fireEvent.click(screen.getByRole("tab", { name: "Docs sweep" }));

    await waitFor(() => {
      expect(workspaceOf("session-2")).not.toBeNull();
    });
    expect(onActiveSessionChange).toHaveBeenCalledWith("session-2");
    expect(workspaceOf("session-1")?.closest("section")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(workspaceOf("session-2")?.closest("section")).toHaveAttribute(
      "aria-hidden",
      "false",
    );
    expect(workspaceOf("session-1")).not.toBeNull();
  });

  it("emits close and create intents through the strip", async () => {
    const onCloseSession = vi.fn();
    const onCreateSession = vi.fn();
    render(
      <AgentSessionDeck
        onCloseSession={onCloseSession}
        onCreateSession={onCreateSession}
        sessions={[deckEntry("session-1", "Release audit"), deckEntry("session-2", "Docs sweep")]}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Close Docs sweep" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "New session" }));

    expect(onCloseSession).toHaveBeenCalledWith("session-2");
    expect(onCreateSession).toHaveBeenCalledTimes(1);
  });

  it("hides close buttons when no close handler is provided", async () => {
    render(
      <AgentSessionDeck
        sessions={[deckEntry("session-1", "Release audit")]}
      />,
    );
    await screen.findByRole("tab", { name: "Release audit" });
    expect(
      screen.queryByRole("button", { name: "Close Release audit" }),
    ).not.toBeInTheDocument();
  });

  it("falls back to the first session when the active session disappears", async () => {
    const first = deckEntry("session-1", "Release audit");
    const second = deckEntry("session-2", "Docs sweep");
    const { rerender } = render(
      <AgentSessionDeck
        activeSessionId="session-2"
        sessions={[first, second]}
      />,
    );
    await waitFor(() => expect(workspaceOf("session-2")).not.toBeNull());

    rerender(<AgentSessionDeck activeSessionId="session-2" sessions={[first]} />);

    await waitFor(() => {
      expect(
        workspaceOf("session-1")?.closest("section"),
      ).toHaveAttribute("aria-hidden", "false");
    });
    expect(screen.getByRole("tab", { name: "Release audit" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("shows a running session with a live status indicator", async () => {
    const running = deckEntry("session-1", "Release audit");
    const snapshot = running.runtime.getSnapshot("session-1");
    snapshot.status = "running";
    render(<AgentSessionDeck sessions={[running]} />);
    const tab = await screen.findByRole("tab", { name: "Release audit" });
    expect(tab.querySelector(".animate-pulse")).not.toBeNull();
  });
});
