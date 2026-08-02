import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/test-utils";

const mocks = vi.hoisted(() => ({
  goalSyncCalls: 0,
  relayCalls: [] as boolean[],
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ org: "acme", podKey: "pod-1" }),
}));

vi.mock("@/hooks/useAcpRelay", () => ({
  useAcpRelay: (_podKey: string, _paneId: string, active: boolean) => {
    mocks.relayCalls.push(active);
  },
}));

vi.mock("@/components/workspace/agent-ui/usePodWorkerSession", () => ({
  usePodWorkerSession: (podKey: string) => ({
    controlLease: { status: "idle" },
    liveSession: true,
    workerClient: { register: vi.fn(), transportFor: vi.fn() },
    workerRef: { transport: "pod", podKey },
    workspaceArtifacts: [],
  }),
}));

vi.mock("@/components/doagent/DoAgentGoalBar", () => ({
  DoAgentGoalBar: ({ podKey }: { podKey: string }) => (
    <div data-testid="goal-bar">{podKey}</div>
  ),
  useDoAgentGoalSync: () => {
    mocks.goalSyncCalls += 1;
  },
}));

vi.mock("@agent-cloud/agent-ui", () => ({
  createBuiltinContentRenderers: () => ({}),
  createBuiltinToolRenderers: () => ({}),
  WorkerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  WorkerConversation: ({
    domainPanel,
    headerActions,
    presentation,
    workerRef,
  }: {
    domainPanel: React.ReactNode;
    headerActions: React.ReactNode;
    presentation: string;
    workerRef: { transport: string; podKey: string };
  }) => (
    <div
      data-presentation={presentation}
      data-testid="agent-workspace"
      data-worker-ref={`${workerRef.transport}:${workerRef.podKey}`}
    >
      {headerActions}
      {domainPanel}
    </div>
  ),
}));

import DoAgentConsolePage from "./page";

describe("DoAgentConsolePage", () => {
  beforeEach(() => {
    mocks.goalSyncCalls = 0;
    mocks.relayCalls = [];
  });

  it("renders the console through the shared agent workbench", async () => {
    render(<DoAgentConsolePage />);

    const workspace = await screen.findByTestId("agent-workspace");
    expect(workspace).toHaveAttribute("data-worker-ref", "pod:pod-1");
    expect(workspace).toHaveAttribute("data-presentation", "developer");
  });

  it("mounts the goal bar as a domain panel inside the workbench", async () => {
    render(<DoAgentConsolePage />);

    const workspace = await screen.findByTestId("agent-workspace");
    expect(workspace).toContainElement(screen.getByTestId("goal-bar"));
    expect(screen.getByTestId("goal-bar")).toHaveTextContent("pod-1");
  });

  it("exposes the workspace link as a header action", async () => {
    render(<DoAgentConsolePage />);

    const link = await screen.findByRole("link");
    expect(link).toHaveAttribute("href", "/acme/workspace?pod=pod-1");
  });

  it("keeps the relay control channel subscribed for goal commands", () => {
    render(<DoAgentConsolePage />);

    expect(mocks.relayCalls).toContain(true);
    expect(mocks.goalSyncCalls).toBeGreaterThan(0);
  });
});
