"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { Server, Terminal, ArrowLeft, RefreshCw } from "lucide-react";
import type { InfraClusterSummary } from "@/lib/infra-cluster-summary";
import { getRunnerStatusInfo } from "@/stores/runner";
import { cn } from "@/lib/utils";

interface Props {
  summary: InfraClusterSummary;
  onBack: () => void;
  onRefresh: () => void;
  onSelectRunner: (runnerId: number) => void;
}

export function InfraClusterDetail({
  summary,
  onBack,
  onRefresh,
  onSelectRunner,
}: Props) {
  const t = useTranslations();
  const { cluster, availableAgents, runners, onlineRunners, currentPods, maxPods, status } =
    summary;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Server className="h-8 w-8 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground truncate">{cluster.name}</h1>
            <p className="text-sm text-muted-foreground">
              {cluster.kind} · {t(`runners.clusterStatus.${status}`)} ·{" "}
              {onlineRunners.length}/{runners.length} {t("runners.clusterNodesOnline")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("common.refresh")}
          </Button>
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("common.back")}
          </Button>
        </div>
      </div>

      <div className="surface-card p-6">
        <h2 className="text-lg font-medium mb-2">{t("runners.detail.availableAgents")}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("runners.clusterAgentsHint")}
        </p>
        {availableAgents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("runners.clusterNoAgents")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableAgents.map((agent) => (
              <span
                key={agent}
                className="inline-flex items-center px-3 py-1 rounded-md text-sm bg-info-bg text-info"
              >
                <Terminal className="w-4 h-4 mr-1" />
                {agent}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="surface-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">{t("runners.clusterNodesTitle")}</h2>
          <span className="text-sm text-muted-foreground">
            {currentPods}/{maxPods} pods
          </span>
        </div>
        <div className="divide-y divide-border">
          {runners.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              {t("runners.clusterNoNodes")}
            </p>
          ) : (
            runners.map((runner) => {
              const statusInfo = getRunnerStatusInfo(runner.status);
              return (
                <button
                  key={runner.id}
                  type="button"
                  className="w-full flex items-center gap-3 py-3 text-left hover:bg-surface-muted px-2 -mx-2 rounded-md"
                  onClick={() => onSelectRunner(runner.id)}
                >
                  <span className={cn("w-2 h-2 rounded-full shrink-0", statusInfo.dotColor)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{runner.node_id}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {(runner.available_agents ?? []).join(", ") || "—"}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {runner.current_pods}/{runner.max_concurrent_pods}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
