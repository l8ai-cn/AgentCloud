import { describe, expect, it } from "vitest";
import { summarizeInfraClusters } from "./infra-cluster-summary";
import type { ExecutionCluster } from "@/lib/api/facade/executionCluster";
import type { RunnerData } from "@/lib/viewModels/runner";

const online: ExecutionCluster = {
  id: 31,
  slug: "online",
  name: "Online cluster",
  kind: "online",
  status: "ready",
  runnerCount: 2,
  onlineRunnerCount: 2,
  availableRunnerCount: 2,
  tunnelStatus: "connected",
};

function runner(
  partial: Pick<RunnerData, "id" | "node_id" | "status" | "available_agents"> &
    Partial<RunnerData>,
): RunnerData {
  return {
    description: undefined,
    last_heartbeat: "",
    current_pods: 0,
    max_concurrent_pods: 100,
    runner_version: "dev",
    is_enabled: true,
    visibility: "organization",
    created_at: "",
    updated_at: "",
    cluster_id: 31,
    ...partial,
  };
}

describe("summarizeInfraClusters", () => {
  it("aggregates available agents across runners in one cluster", () => {
    const runners = [
      runner({
        id: 1,
        node_id: "codex",
        status: "online",
        available_agents: ["codex-cli", "pattern-designer"],
      }),
      runner({
        id: 2,
        node_id: "kimi",
        status: "online",
        available_agents: ["kimi-code"],
      }),
      runner({
        id: 3,
        node_id: "offline",
        status: "offline",
        available_agents: ["hermes"],
      }),
    ];
    const [summary] = summarizeInfraClusters([online], runners);
    expect(summary.status).toBe("online");
    expect(summary.availableAgents).toEqual([
      "codex-cli",
      "kimi-code",
      "pattern-designer",
    ]);
    expect(summary.onlineRunners).toHaveLength(2);
  });
});
