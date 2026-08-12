import type { ExecutionCluster } from "@/lib/api/facade/executionCluster";
import type { RunnerData } from "@/lib/viewModels/runner";

export interface InfraClusterSummary {
  cluster: ExecutionCluster;
  runners: RunnerData[];
  onlineRunners: RunnerData[];
  availableAgents: string[];
  currentPods: number;
  maxPods: number;
  status: "online" | "offline" | "pending";
}

export function summarizeInfraClusters(
  clusters: ExecutionCluster[],
  runners: RunnerData[],
): InfraClusterSummary[] {
  return clusters.map((cluster) => {
    const clusterRunners = runners.filter((r) => r.cluster_id === cluster.id);
    const onlineRunners = clusterRunners.filter((r) => r.status === "online" && r.is_enabled);
    const availableAgents = [
      ...new Set(
        onlineRunners.flatMap((r) => r.available_agents ?? []).filter(Boolean),
      ),
    ].sort();
    const currentPods = clusterRunners.reduce((sum, r) => sum + r.current_pods, 0);
    const maxPods = clusterRunners.reduce((sum, r) => sum + r.max_concurrent_pods, 0);
    const status: InfraClusterSummary["status"] =
      onlineRunners.length > 0
        ? "online"
        : clusterRunners.length > 0
          ? "offline"
          : "pending";
    return {
      cluster,
      runners: clusterRunners,
      onlineRunners,
      availableAgents,
      currentPods,
      maxPods,
      status,
    };
  });
}
