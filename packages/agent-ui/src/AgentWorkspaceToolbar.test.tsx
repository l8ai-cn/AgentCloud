import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { vi } from "vitest";

import { AgentWorkspace } from "./AgentWorkspace";
import {
  agentWorkspaceRuntime as runtime,
  agentWorkspaceSnapshot as sessionSnapshot,
} from "./AgentWorkspace.test-fixture";

describe("AgentWorkspace toolbar", () => {
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

  it("merges title, view tabs, and status into a single header row", async () => {
    const snapshot = sessionSnapshot();
    const { agentRuntime, terminalRuntime } = runtime(snapshot);

    render(
      <AgentWorkspace
        runtime={agentRuntime}
        terminalRuntime={terminalRuntime}
        sessionId={snapshot.sessionId}
      />,
    );

    const banner = await screen.findByRole("banner");
    expect(within(banner).getByText("Release audit")).toBeVisible();
    const tablist = within(banner).getByRole("tablist", {
      name: "Workspace views",
    });
    expect(within(tablist).getByRole("tab", { name: "Terminal" })).toBeEnabled();
    expect(screen.getAllByRole("banner")).toHaveLength(1);
  });

  it("toggles fullscreen from the header when the Fullscreen API is available", async () => {
    const requestFullscreen = vi.fn(async () => undefined);
    const enabledDescriptor = Object.getOwnPropertyDescriptor(
      document,
      "fullscreenEnabled",
    );
    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    try {
      const snapshot = sessionSnapshot();
      snapshot.status = "idle";
      const { agentRuntime } = runtime(snapshot);

      render(<AgentWorkspace runtime={agentRuntime} sessionId={snapshot.sessionId} />);

      const toggle = await screen.findByRole("button", {
        name: "Enter fullscreen",
      });
      fireEvent.click(toggle);
      expect(requestFullscreen).toHaveBeenCalledTimes(1);

      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        get: () => document.querySelector("[data-agent-workspace]"),
      });
      fireEvent(document, new Event("fullscreenchange"));

      expect(
        await screen.findByRole("button", { name: "Exit fullscreen" }),
      ).toBeVisible();
    } finally {
      if (enabledDescriptor) {
        Object.defineProperty(document, "fullscreenEnabled", enabledDescriptor);
      } else {
        delete (document as { fullscreenEnabled?: boolean }).fullscreenEnabled;
      }
      delete (document as { fullscreenElement?: Element | null })
        .fullscreenElement;
      delete (HTMLElement.prototype as { requestFullscreen?: unknown })
        .requestFullscreen;
    }
  });

  it("hides the fullscreen toggle when the Fullscreen API is unavailable", async () => {
    const snapshot = sessionSnapshot();
    snapshot.status = "idle";
    const { agentRuntime } = runtime(snapshot);

    render(<AgentWorkspace runtime={agentRuntime} sessionId={snapshot.sessionId} />);

    await screen.findByText("Release audit");
    expect(
      screen.queryByRole("button", { name: "Enter fullscreen" }),
    ).not.toBeInTheDocument();
  });
});
