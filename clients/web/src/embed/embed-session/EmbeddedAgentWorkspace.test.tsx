import type { AgentSessionRuntime, AgentSessionSnapshot, TerminalRuntime } from "@agent-cloud/agent-ui";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { EmbeddedAgentWorkspace } from "./EmbeddedAgentWorkspace";
import type { EmbeddedAgentWorkbenchAccess } from "./embeddedAgentWorkbenchAccess";

vi.mock("./createEmbeddedAgentWorkbenchRuntime", () => ({
  createEmbeddedAgentWorkbenchRuntime: vi.fn(
    async (access: EmbeddedAgentWorkbenchAccess) => ({
      runtime: fakeRuntime(access.sessionId),
      terminalRuntime: fakeTerminalRuntime(),
    }),
  ),
}));

function fakeSnapshot(sessionId: string): AgentSessionSnapshot {
  return {
    sessionId,
    title: `会话 ${sessionId}`,
    agentLabel: "Codex",
    status: "idle",
    connection: "connected",
    interactionMode: "acp",
    capabilities: {
      sendMessage: true,
      interrupt: true,
      resolvePermission: true,
      updateConfiguration: true,
      terminal: false,
    },
    items: [],
    plan: [],
    permissions: [],
    terminals: [],
    hasOlderItems: false,
    error: null,
  };
}

function fakeRuntime(sessionId: string): AgentSessionRuntime {
  const snapshot = fakeSnapshot(sessionId);
  return {
    open: vi.fn(async () => undefined),
    close: vi.fn(),
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    sendMessage: vi.fn(async () => undefined),
    interrupt: vi.fn(async () => undefined),
    resolvePermission: vi.fn(async () => undefined),
    updateConfiguration: vi.fn(async () => undefined),
    loadOlder: vi.fn(async () => undefined),
  };
}

function fakeTerminalRuntime(): TerminalRuntime {
  return {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(),
    subscribeOutput: () => () => undefined,
    subscribeStatus: () => () => undefined,
    write: vi.fn(async () => undefined),
    resize: vi.fn(async () => undefined),
    acquireControl: vi.fn(async () => ({ leaseId: "lease", expiresAt: 0 })),
    renewControl: vi.fn(async () => undefined),
    releaseControl: vi.fn(async () => undefined),
  };
}

function makeAccess(sessionId: string): EmbeddedAgentWorkbenchAccess {
  return {
    baseUrl: "https://embed.test",
    getAccessToken: () => "token",
    orgSlug: "acme",
    sessionApi: { requestHeaders: {}, sessionPath: `/v1/embed/sessions/${sessionId}` },
    sessionId,
  };
}

function workspaceOf(sessionId: string) {
  return document.querySelector(`[data-agent-workspace="${sessionId}"]`);
}

describe("EmbeddedAgentWorkspace", () => {
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

  it("renders a single session workspace without a session strip", async () => {
    render(<EmbeddedAgentWorkspace access={makeAccess("s-1")} />);

    await waitFor(() => expect(workspaceOf("s-1")).not.toBeNull());
    expect(screen.queryByRole("tablist", { name: "会话" })).not.toBeInTheDocument();
  });

  it("renders a session deck when multiple sessions are provided", async () => {
    render(
      <EmbeddedAgentWorkspace sessions={[makeAccess("s-1"), makeAccess("s-2")]} />,
    );

    expect(await screen.findByRole("tab", { name: "会话 s-1" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "会话 s-2" })).toBeVisible();
    expect(workspaceOf("s-1")).not.toBeNull();
    expect(workspaceOf("s-2")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "会话 s-2" }));

    await waitFor(() => expect(workspaceOf("s-2")).not.toBeNull());
    expect(workspaceOf("s-1")?.closest("section")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("shows an error when no session access is provided", async () => {
    render(<EmbeddedAgentWorkspace />);
    expect(await screen.findByRole("alert")).toHaveTextContent("缺少嵌入会话参数");
  });
});
