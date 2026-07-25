import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import type { AgentSessionRuntime } from "../../agentSessionRuntime";
import type { AgentSessionSnapshot } from "../../contracts";
import { WorkerClient } from "../WorkerClient";
import type { WorkerTransport } from "../contracts";
import type { WorkerLiveness } from "../liveness/workerLiveness";
import { WorkerConversation } from "./WorkerConversation";
import { WorkerProvider } from "./WorkerProvider";

vi.mock("../../AgentWorkspace", () => ({
  AgentWorkspace: ({
    readOnly,
    sessionId,
  }: {
    readOnly: boolean;
    sessionId: string;
  }) => (
    <div
      data-readonly={String(readOnly)}
      data-session={sessionId}
      data-testid="agent-workspace"
    />
  ),
}));

function snapshot(): AgentSessionSnapshot {
  return {
    sessionId: "session-1",
    title: "t",
    agentLabel: "a",
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

function runtime(): AgentSessionRuntime {
  const snap = snapshot();
  return {
    open: vi.fn(async () => undefined),
    close: vi.fn(),
    getSnapshot: () => snap,
    subscribe: () => () => undefined,
    sendMessage: vi.fn(async () => undefined),
    interrupt: vi.fn(async () => undefined),
    resolvePermission: vi.fn(async () => undefined),
    updateConfiguration: vi.fn(async () => undefined),
    loadOlder: vi.fn(async () => undefined),
  };
}

function transport(liveness: WorkerLiveness): WorkerTransport {
  return {
    kind: "pod",
    resolveSession: vi.fn(async () => "session-1"),
    runtimeFor: vi.fn(() => runtime()),
    closeSession: vi.fn(),
    subscribeLiveness: (_ref, listener) => {
      listener(liveness);
      return () => undefined;
    },
  };
}

describe("WorkerConversation", () => {
  it("shows liveness view while starting", () => {
    const client = new WorkerClient();
    client.register(transport({ state: "starting", progress: "boot" }));
    render(
      <WorkerProvider client={client}>
        <WorkerConversation
          workerRef={{ transport: "pod", podKey: "pod-1" }}
        />
      </WorkerProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Waiting for Worker to be ready…",
    );
    expect(screen.getByText("boot")).toBeInTheDocument();
  });

  it("mounts AgentWorkspace read-only when online with ended", async () => {
    const client = new WorkerClient();
    client.register(
      transport({ state: "online", readOnly: "ended" }),
    );
    render(
      <WorkerProvider client={client}>
        <WorkerConversation
          workerRef={{ transport: "pod", podKey: "pod-1" }}
        />
      </WorkerProvider>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("agent-workspace")).toHaveAttribute(
        "data-readonly",
        "true",
      );
    });
    expect(screen.getByTestId("agent-workspace")).toHaveAttribute(
      "data-session",
      "session-1",
    );
  });
});
