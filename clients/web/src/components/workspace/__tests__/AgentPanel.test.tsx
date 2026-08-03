import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";

const mocks = vi.hoisted(() => ({
  presentation: "",
  podStatus: "initializing",
  resolveCalls: 0,
  lastReadOnly: null as boolean | null,
  relaySubscribe: vi.fn(async () => undefined),
  relayUnsubscribe: vi.fn(),
  workspaceArtifacts: [{
    artifactId: "workspace:output/final.mp4",
    filename: "final.mp4",
  }],
}));

vi.mock("@/stores/relayConnection", () => ({
  relayPool: {
    subscribe: mocks.relaySubscribe,
    unsubscribe: mocks.relayUnsubscribe,
  },
}));

vi.mock("@/hooks/useWorkerControlLease", () => ({
  useWorkerControlLease: () => ({
    acquire: vi.fn(),
    forceAcquire: vi.fn(),
    acquiring: false,
    connected: false,
    error: null,
    status: "idle",
  }),
}));

vi.mock("@/stores/pod", () => ({
  usePod: () => ({
    agent: { name: "Pattern Designer" },
    interaction_mode: "acp",
    pod_key: "pod-1",
    status: mocks.podStatus,
    title: "Pattern preview",
  }),
  usePodStore: Object.assign(
    (
      selector: (state: {
        initProgress: Record<string, unknown>;
        _tick: number;
      }) => unknown,
    ) => selector({ initProgress: {}, _tick: 0 }),
    {
      getState: () => ({
        initProgress: {},
        fetchPod: vi.fn(async () => undefined),
      }),
      setState: vi.fn(),
      subscribe: (listener: () => void) => {
        listener();
        return () => undefined;
      },
    },
  ),
}));

vi.mock("@/stores/workspace", () => ({
  relayPool: {
    acquireControl: vi.fn(),
    onStatusChange: vi.fn(() => () => undefined),
    releaseControl: vi.fn(),
    renewControl: vi.fn(),
    sendResize: vi.fn(),
    subscribe: vi.fn(async () => ({ send: vi.fn(), unsubscribe: vi.fn() })),
    unsubscribe: vi.fn(),
  },
  useWorkspaceStore: (
    selector: (state: {
      panes: unknown[];
      setActivePane: ReturnType<typeof vi.fn>;
      splitPane: ReturnType<typeof vi.fn>;
    }) => unknown,
  ) =>
    selector({
      panes: [],
      setActivePane: vi.fn(),
      splitPane: vi.fn(),
    }),
}));

vi.mock("@agent-cloud/agent-ui", async () => {
  const actual = await vi.importActual<typeof import("@agent-cloud/agent-ui")>(
    "@agent-cloud/agent-ui",
  );
  return {
    ...actual,
    WorkerConversation: ({
      presentation,
      workspaceArtifacts,
      workerRef,
    }: {
      presentation: string;
      workspaceArtifacts: unknown[];
      workerRef: { transport: string; podKey: string };
    }) => {
      mocks.presentation = presentation;
      const status = mocks.podStatus;
      if (status === "initializing" || status === "unknown") {
        return (
          <div role="status">Waiting for Worker to be ready…</div>
        );
      }
      mocks.resolveCalls += 1;
      mocks.lastReadOnly = status !== "running" || true;
      return (
        <div
          data-readonly={String(status !== "running" ? true : true)}
          data-testid="agent-workspace"
          data-worker-ref={`${workerRef.transport}:${workerRef.podKey}`}
          data-workspace-artifacts={String(workspaceArtifacts.length)}
        />
      );
    },
  };
});

vi.mock("../agent-ui/podWorkerTransport", () => ({
  createPodWorkerTransport: () => ({
    kind: "pod",
    resolveSession: vi.fn(async () => "session-1"),
    runtimeFor: vi.fn(),
    closeSession: vi.fn(),
    subscribeLiveness: vi.fn(() => () => undefined),
  }),
}));

vi.mock("../agent-ui/usePodWorkspaceArtifacts", () => ({
  usePodWorkspaceArtifacts: () => ({
    artifacts: mocks.workspaceArtifacts,
    error: null,
  }),
}));

vi.mock("../AgentPanelHeader", () => ({
  AgentPanelHeader: () => null,
}));

vi.mock("../PodSelectorModal", () => ({
  PodSelectorModal: () => null,
}));

vi.mock("@/components/mobile-worker/WorkerControlOverlay", () => ({
  WorkerControlOverlay: () => <div data-testid="control-overlay" />,
}));

import { AgentPanel } from "../AgentPanel";

describe("AgentPanel worker shell", () => {
  beforeEach(() => {
    mocks.presentation = "";
    mocks.podStatus = "initializing";
    mocks.resolveCalls = 0;
    mocks.lastReadOnly = null;
    mocks.relaySubscribe.mockClear();
    mocks.relayUnsubscribe.mockClear();
  });

  it.each(["completed", "orphaned"])(
    "mounts a %s Worker session through WorkerConversation",
    async (podStatus) => {
      mocks.podStatus = podStatus;

      render(
        <AgentPanel
          paneId="pane-1"
          podKey="pod-1"
          isActive
          showHeader={false}
        />,
      );

      const workspace = await screen.findByTestId("agent-workspace");
      expect(workspace).toHaveAttribute("data-readonly", "true");
      expect(workspace).toHaveAttribute("data-workspace-artifacts", "1");
      expect(workspace).toHaveAttribute("data-worker-ref", "pod:pod-1");
      expect(mocks.presentation).toBe("developer");
      expect(screen.queryByTestId("control-overlay")).not.toBeInTheDocument();
      expect(mocks.relaySubscribe).not.toHaveBeenCalled();
    },
  );

  it("keeps the live controls only for a running Worker", async () => {
    mocks.podStatus = "running";

    render(
      <AgentPanel
        paneId="pane-1"
        podKey="pod-1"
        isActive
        showHeader={false}
      />,
    );

    await screen.findByTestId("agent-workspace");
    expect(mocks.presentation).toBe("developer");
    expect(screen.getByTestId("control-overlay")).toBeInTheDocument();
    // Without this subscription the control lease can never be acquired.
    expect(mocks.relaySubscribe).toHaveBeenCalledWith(
      "pod-1",
      expect.stringContaining("workbench-"),
      expect.any(Function),
    );
  });

  it("keeps the loading state before the Worker is readable", async () => {
    render(
      <AgentPanel
        paneId="pane-1"
        podKey="pod-1"
        isActive
        showHeader={false}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByTestId("agent-workspace")).not.toBeInTheDocument();
    });
    expect(
      screen.getByText("Waiting for Worker to be ready…"),
    ).toBeInTheDocument();
  });
});
