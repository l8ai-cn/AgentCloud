"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getDashboard as getDashboardConnect } from "@/lib/api/facade/tokenUsageConnect";
import { readCurrentOrg } from "@/stores/auth";
import type {
  TokenUsageSummary,
  TokenUsageTimeSeriesPoint,
  TokenUsageByAgent,
  TokenUsageByUser,
  TokenUsageByModel,
  TokenUsageQueryParams,
} from "@/lib/api";
import type { TranslationFn } from "./GeneralSettings";
import {
  UsageOverviewCards,
  UsageTimeSeriesChart,
  UsageByAgentChart,
  UsageByUserTable,
  UsageByModelTable,
  UsageFilters,
  UsageLiveSessionCost,
  UsageLoadingSkeleton,
  type TimeRange,
  type Granularity,
} from "./usage";
import { fetchOrgLiveUsageSummary, type OrgLiveUsageSummary } from "@/lib/api/orgLiveUsageFetch";
import { TokenQuotaPanel } from "./TokenQuotaPanel";
import {
  getTimeRangeDates,
  isValidGranularity,
  isValidTimeRange,
} from "./usageSettingsSupport";

interface UsageSettingsProps {
  t: TranslationFn;
}

export function UsageSettings({ t }: UsageSettingsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    const v = searchParams.get("timeRange");
    return isValidTimeRange(v) ? v : "30d";
  });
  const [granularity, setGranularity] = useState<Granularity>(() => {
    const v = searchParams.get("granularity");
    return isValidGranularity(v) ? v : "day";
  });
  const [agent, setAgent] = useState(() => searchParams.get("agent") || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TokenUsageSummary | null>(null);
  const [timeSeries, setTimeSeries] = useState<TokenUsageTimeSeriesPoint[]>([]);
  const [byAgent, setByAgent] = useState<TokenUsageByAgent[]>([]);
  const [byUser, setByUser] = useState<TokenUsageByUser[]>([]);
  const [byModel, setByModel] = useState<TokenUsageByModel[]>([]);
  const [liveUsage, setLiveUsage] = useState<OrgLiveUsageSummary | null>(null);
  const [allAgents, setAllAgents] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (timeRange !== "30d") params.set("timeRange", timeRange);
    else params.delete("timeRange");
    if (granularity !== "day") params.set("granularity", granularity);
    else params.delete("granularity");
    if (agent) params.set("agent", agent);
    else params.delete("agent");
    const next = params.toString();
    if (next !== searchParams.toString()) {
      router.replace(`?${next}`, { scroll: false });
    }
  }, [timeRange, granularity, agent, searchParams, router]);

  const loadData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    const { start, end } = getTimeRangeDates(timeRange);
    const params: TokenUsageQueryParams = {
      start_time: start,
      end_time: end,
      granularity,
      agent_slug: agent || undefined,
    };
    try {
      const data = await getDashboardConnect({
        orgSlug: readCurrentOrg()?.slug ?? "",
        startTime: params.start_time ?? undefined,
        endTime: params.end_time ?? undefined,
        agentSlug: params.agent_slug ?? undefined,
        userId: params.user_id != null ? params.user_id : undefined,
        model: params.model ?? undefined,
        granularity: params.granularity ?? undefined,
      });
      if (controller.signal.aborted) return;
      setSummary(data.summary ?? null);
      setTimeSeries(data.time_series ?? []);
      setByAgent(data.by_agent ?? []);
      setByUser(data.by_user ?? []);
      setByModel(data.by_model ?? []);
      const live = await fetchOrgLiveUsageSummary();
      if (!controller.signal.aborted) setLiveUsage(live);
      if (!agent && data.by_agent) {
        setAllAgents(
          [...new Set(data.by_agent.map((a: TokenUsageByAgent) => a.agent_slug))]
            .filter(Boolean) as string[],
        );
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(tRef.current("settings.usagePage.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [timeRange, granularity, agent]);

  useEffect(() => {
    loadData();
    return () => abortRef.current?.abort();
  }, [loadData]);

  if (loading && !summary) return <UsageLoadingSkeleton />;
  if (error && !summary) {
    return (
      <div className="space-y-6">
        <div className="surface-card p-6">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" className="mt-4" onClick={loadData}>
            {t("settings.usagePage.retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t("settings.usagePage.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("settings.usagePage.description")}
        </p>
      </div>
      {error && (
        <div className="p-4 rounded-lg bg-danger-bg text-danger border border-danger">
          {error}
        </div>
      )}
      <UsageFilters
        timeRange={timeRange}
        granularity={granularity}
        agent={agent}
        onTimeRangeChange={setTimeRange}
        onGranularityChange={setGranularity}
        onAgentChange={setAgent}
        agents={allAgents}
        t={t}
      />
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {t("settings.usagePage.historicalSection")}
      </p>
      <UsageOverviewCards summary={summary} t={t} />
      <UsageTimeSeriesChart data={timeSeries} t={t} />
      <UsageByAgentChart data={byAgent} t={t} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UsageByUserTable data={byUser} t={t} />
        <UsageByModelTable data={byModel} t={t} />
      </div>
      <UsageLiveSessionCost live={liveUsage} t={t} />
      <TokenQuotaPanel t={t} />
    </div>
  );
}
