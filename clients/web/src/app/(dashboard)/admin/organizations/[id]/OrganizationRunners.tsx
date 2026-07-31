"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown, ExternalLink, RefreshCw, Server } from "lucide-react";

import { AlertMessage } from "@/components/ui/alert-message";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { AdminRunner } from "@/lib/api/admin/runners";
import { useOrganizationRunners } from "./useOrganizationRunners";

function statusVariant(status: string): BadgeProps["variant"] {
  if (status === "online") return "success";
  if (status === "degraded") return "warning";
  return "secondary";
}

function RunnerDetails({ runner }: { runner: AdminRunner }) {
  const t = useTranslations("admin");

  return (
    <details className="group border-b border-border last:border-b-0">
      <summary className="grid cursor-pointer list-none gap-3 px-4 py-3 hover:bg-surface-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:grid-cols-[minmax(0,2fr)_minmax(12rem,1fr)_auto] md:items-center [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-muted">
            <Server className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium">{runner.node_id}</span>
              <Badge variant={statusVariant(runner.status)}>{runner.status}</Badge>
              {!runner.is_enabled && <Badge variant="destructive">{t("common.disabled")}</Badge>}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {runner.runner_version
                ? t("organizations.runnerVersionAndPods", {
                    version: runner.runner_version,
                    current: runner.current_pods,
                    max: runner.max_concurrent_pods,
                  })
                : t("organizations.runnerPods", {
                    current: runner.current_pods,
                    max: runner.max_concurrent_pods,
                  })}
            </p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {runner.last_heartbeat
            ? t("organizations.runnerLastHeartbeat", {
                time: new Date(runner.last_heartbeat).toLocaleString(),
              })
            : t("organizations.runnerNoHeartbeat")}
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 bg-surface-muted/30 px-4 py-3 text-xs sm:grid-cols-3">
        <div>
          <p className="font-medium text-foreground">{t("organizations.runnerDescription")}</p>
          <p className="mt-1 text-muted-foreground">
            {runner.description || t("organizations.runnerNoDescription")}
          </p>
        </div>
        <div>
          <p className="font-medium text-foreground">{t("organizations.runnerAgents")}</p>
          <p className="mt-1 text-muted-foreground">
            {runner.available_agents.length > 0
              ? runner.available_agents.join(", ")
              : t("organizations.runnerNoAgents")}
          </p>
        </div>
        <div>
          <p className="font-medium text-foreground">{t("organizations.runnerRegistered")}</p>
          <p className="mt-1 text-muted-foreground">
            {new Date(runner.created_at).toLocaleString()}
          </p>
        </div>
      </div>
    </details>
  );
}

export function OrganizationRunners({ orgId }: { orgId: number }) {
  const t = useTranslations("admin");
  const { data, error, loading, page, setPage, reload } = useOrganizationRunners(orgId);

  return (
    <section className="border-t border-border pt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">
            {t("organizations.runnersHeading", { count: data?.total ?? 0 })}
          </h2>
          {loading && (
            <span className="text-xs text-muted-foreground">{t("common.loading")}</span>
          )}
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/runners">
            {t("organizations.runnerManagement")}
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {error ? (
        <div className="space-y-3">
          <AlertMessage type="error" message={error} />
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("organizations.runnersRetry")}
          </Button>
        </div>
      ) : loading && !data ? (
        <div
          aria-label={t("organizations.runnersLoadingAria")}
          className="space-y-1 rounded-md border border-border p-4"
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-md bg-surface-muted" />
          ))}
        </div>
      ) : data?.data.length ? (
        <>
          <div className="overflow-hidden rounded-md border border-border bg-surface-raised">
            {data.data.map((runner) => (
              <RunnerDetails key={runner.id} runner={runner} />
            ))}
          </div>
          {data.total_pages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t("common.pageOf", { page: data.page, total: data.total_pages })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((value) => value - 1)}
                >
                  {t("common.previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.total_pages || loading}
                  onClick={() => setPage((value) => value + 1)}
                >
                  {t("common.next")}
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          size="compact"
          icon={<Server className="h-5 w-5" />}
          title={t("organizations.runnersEmptyTitle")}
          description={t("organizations.runnersEmptyDescription")}
        />
      )}
    </section>
  );
}
