import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { AgentWorkspace } from "./AgentWorkspace";
import {
  agentWorkspaceRuntime as runtime,
  agentWorkspaceSnapshot as sessionSnapshot,
} from "./AgentWorkspace.test-fixture";
import { CONVERSATION_CONTENT_WIDTH } from "./conversationContentWidth";

// The composer, the timeline and the approval dock are separate stacked bands.
// If any of them caps its width differently the column visibly steps in and
// out, so the shared token is asserted rather than each literal class.
const widthSelector = `.${CONVERSATION_CONTENT_WIDTH.split(" ").join(".")}`;

function bandOf(element: HTMLElement | null): HTMLElement | null {
  return element?.closest(widthSelector) as HTMLElement | null;
}

describe("conversation content width", () => {
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

  it("aligns the timeline, approval dock and composer on one column", async () => {
    const snapshot = sessionSnapshot();
    const { agentRuntime } = runtime(snapshot);

    render(
      <AgentWorkspace runtime={agentRuntime} sessionId={snapshot.sessionId} />,
    );

    const composer = await screen.findByRole("textbox");
    expect(bandOf(composer)).not.toBeNull();
    expect(bandOf(screen.getByText(snapshot.permissions[0].title))).not.toBeNull();
    expect(document.querySelectorAll(widthSelector).length).toBeGreaterThan(2);
  });

  it("centers the empty-state heading on the composer column", async () => {
    const snapshot = sessionSnapshot();
    snapshot.items = [];
    snapshot.permissions = [];
    snapshot.status = "idle";
    const { agentRuntime } = runtime(snapshot);

    render(
      <AgentWorkspace runtime={agentRuntime} sessionId={snapshot.sessionId} />,
    );

    const heading = await screen.findByRole("heading", { level: 2 });
    expect(bandOf(heading)).not.toBeNull();
    expect(bandOf(screen.getByRole("textbox"))).not.toBeNull();
    expect(bandOf(heading)).not.toBe(bandOf(screen.getByRole("textbox")));
  });

  it("keeps the empty state scrollable instead of clipping a tall column", async () => {
    const snapshot = sessionSnapshot();
    snapshot.items = [];
    snapshot.permissions = [];
    snapshot.status = "idle";
    const { agentRuntime } = runtime(snapshot);

    render(
      <AgentWorkspace runtime={agentRuntime} sessionId={snapshot.sessionId} />,
    );

    const scroller = await screen.findByRole("main");
    expect(scroller.className).toContain("overflow-y-auto");
    // Centering must live on the inner band; justify-center on the scroller
    // itself puts the overflowing top out of reach.
    expect(scroller.className).not.toContain("justify-center");
    expect(scroller.firstElementChild?.className).toContain("min-h-full");
    expect(scroller.firstElementChild?.className).toContain("justify-center");
  });
});
