"use client";

import { useState } from "react";
import { RefreshCw, Search, Server } from "lucide-react";
import { useTranslations } from "next-intl";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useSearchPagination } from "@/hooks/useSearchPagination";
import type { AdminRunner } from "@/lib/api/admin/runners";
import { RunnerRow } from "./RunnerRow";
import { type RunnerAction, useAdminRunners } from "./useAdminRunners";

export default function AdminRunnersPage() {
  const t = useTranslations("admin");
  const { query, setQuery, search, page, setPage } = useSearchPagination();
  const [pending, setPending] = useState<{ runner: AdminRunner; action: RunnerAction } | null>(null);
  const { data, loading, error, mutating, reload, runAction } = useAdminRunners(search, page);

  const nodeId = pending?.runner.node_id ?? "";
  const confirmCopy: Record<
    RunnerAction,
    { title: string; description: string; destructive: boolean }
  > = {
    disable: {
      title: t("runners.confirm.disable.title"),
      description: t("runners.confirm.disable.description", { nodeId }),
      destructive: true,
    },
    enable: {
      title: t("runners.confirm.enable.title"),
      description: t("runners.confirm.enable.description", { nodeId }),
      destructive: false,
    },
    delete: {
      title: t("runners.confirm.delete.title"),
      description: t("runners.confirm.delete.description", { nodeId }),
      destructive: true,
    },
  };
  const copy = pending ? confirmCopy[pending.action] : null;

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        title={t("nav.runners")}
        subtitle={t("runners.subtitle")}
        actions={
          <Button variant="outline" size="sm" onClick={reload} loading={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("common.refresh")}
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("runners.searchPlaceholder")}
          className="pl-9"
          aria-label={t("runners.searchLabel")}
        />
      </div>

      {error && <AlertMessage type="error" message={error} />}

      <section className="overflow-hidden rounded-md border border-border bg-surface-raised">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{t("runners.count", { count: data?.total ?? 0 })}</h2>
          {loading && <span className="text-xs text-muted-foreground">{t("common.loading")}</span>}
        </div>
        {loading && !data ? (
          <div className="space-y-1 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-md bg-surface-muted" />
            ))}
          </div>
        ) : data?.data.length ? (
          data.data.map((runner) => (
            <RunnerRow
              key={runner.id}
              runner={runner}
              disabled={mutating}
              onAction={(target, action) => setPending({ runner: target, action })}
            />
          ))
        ) : (
          <EmptyState
            size="compact"
            icon={<Server className="h-5 w-5" />}
            title={t("runners.empty.title")}
            description={search ? t("common.tryDifferentSearch") : t("runners.empty.description")}
          />
        )}
      </section>

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("common.pageOf", { page: data.page, total: data.total_pages })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>{t("common.previous")}</Button>
            <Button variant="outline" size="sm" disabled={page >= data.total_pages || loading} onClick={() => setPage((value) => value + 1)}>{t("common.next")}</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={copy?.title ?? ""}
        description={copy?.description}
        variant={copy?.destructive ? "destructive" : "default"}
        confirmText={t("common.confirm")}
        loading={mutating}
        onConfirm={async () => {
          if (!pending) return;
          await runAction(pending.action, pending.runner.id);
          setPending(null);
        }}
      />
    </div>
  );
}
