"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useCurrentOrg } from "@/stores/auth";
import { useRunnerStore, useRunners } from "@/stores/runner";
import { listExecutionClusters } from "@/lib/api/facade/executionClusterApi";
import type { ExecutionCluster } from "@/lib/api/facade/executionCluster";
import {
  summarizeInfraClusters,
  type InfraClusterSummary,
} from "@/lib/infra-cluster-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Server, Loader2, Plus, Search, RefreshCw, Activity } from "lucide-react";

interface Props {
  className?: string;
  onAddRunner?: () => void;
}

function statusDot(status: InfraClusterSummary["status"]) {
  if (status === "online") return "bg-success";
  if (status === "offline") return "bg-muted-foreground";
  return "bg-warning";
}

export function RunnersSidebarContent({ className, onAddRunner }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentOrg = useCurrentOrg();
  const runners = useRunners();
  const loadingRunners = useRunnerStore((s) => s.loading);
  const fetchRunners = useRunnerStore((s) => s.fetchRunners);

  const [clusters, setClusters] = useState<ExecutionCluster[]>([]);
  const [loadingClusters, setLoadingClusters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedClusterId = useMemo(() => {
    const raw = searchParams.get("cluster");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoadingClusters(true);
    try {
      const [items] = await Promise.all([
        listExecutionClusters(currentOrg.slug),
        fetchRunners(),
      ]);
      setClusters(items);
    } finally {
      setLoadingClusters(false);
    }
  }, [currentOrg, fetchRunners]);

  useEffect(() => {
    void load();
  }, [load]);

  const summaries = useMemo(
    () => summarizeInfraClusters(clusters, runners),
    [clusters, runners],
  );

  const filtered = summaries.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.cluster.name.toLowerCase().includes(q) ||
      s.cluster.slug.toLowerCase().includes(q) ||
      s.availableAgents.some((a) => a.includes(q))
    );
  });

  const onlineCount = summaries.filter((s) => s.status === "online").length;
  const totalPods = summaries.reduce((sum, s) => sum + s.currentPods, 0);
  const totalCapacity = summaries.reduce((sum, s) => sum + s.maxPods, 0);

  const openCluster = (id: number) => {
    router.push(`/${currentOrg?.slug}/infra?tab=runners&cluster=${id}`);
  };

  const handleAdd = () => {
    if (onAddRunner) onAddRunner();
    else router.push(`/${currentOrg?.slug}/infra?tab=runners`);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const loading = (loadingClusters || loadingRunners) && summaries.length === 0;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="px-2 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("runners.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 px-2 pb-2">
        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={handleAdd}>
          <Plus className="w-3 h-3 mr-1" />
          {t("runners.addRunner")}
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
        </Button>
      </div>

      <div className="px-3 py-2 border-t border-border space-y-2">
        <div className="text-xs font-medium text-muted-foreground">{t("runners.overview.title")}</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 text-xs">
            <Server className="w-3.5 h-3.5 text-success" />
            <span>
              {onlineCount} {t("runners.overview.online")}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Activity className="w-3.5 h-3.5 text-info" />
            <span>
              {totalPods}/{totalCapacity} pods
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border">
          {filtered.length} {t("runners.runnerCount")}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            {t("runners.emptyState.title")}
          </div>
        ) : (
          <div className="py-1">
            {filtered.map((summary) => {
              const selected = selectedClusterId === summary.cluster.id;
              return (
                <button
                  key={summary.cluster.id}
                  type="button"
                  className={cn(
                    "w-full group flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-muted",
                    selected && "bg-muted/30",
                  )}
                  onClick={() => openCluster(summary.cluster.id)}
                >
                  <span className={cn("w-2 h-2 rounded-full shrink-0", statusDot(summary.status))} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate font-medium">{summary.cluster.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {summary.availableAgents.length > 0
                        ? summary.availableAgents.join(", ")
                        : t("runners.clusterNoAgents")}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default RunnersSidebarContent;
