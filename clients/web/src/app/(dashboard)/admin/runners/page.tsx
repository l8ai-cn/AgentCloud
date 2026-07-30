"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Search, Server } from "lucide-react";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import type { AdminRunner } from "@/lib/api/admin/runners";
import { RunnerRow } from "./RunnerRow";
import { type RunnerAction, useAdminRunners } from "./useAdminRunners";

const actionCopy: Record<
  RunnerAction,
  { title: string; description: string; destructive: boolean }
> = {
  disable: {
    title: "Disable this runner?",
    description: "The runner stays connected but will no longer receive new pods.",
    destructive: true,
  },
  enable: {
    title: "Enable this runner?",
    description: "The runner becomes eligible to receive new pods again.",
    destructive: false,
  },
  delete: {
    title: "Delete this runner?",
    description: "This permanently removes the runner registration and cannot be undone.",
    destructive: true,
  },
};

export default function AdminRunnersPage() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{ runner: AdminRunner; action: RunnerAction } | null>(null);
  const { data, loading, error, mutating, reload, runAction } = useAdminRunners(search, page);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const copy = pending ? actionCopy[pending.action] : null;

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        title="Runners"
        subtitle="Inspect self-hosted runners across all organizations and control their availability."
        actions={
          <Button variant="outline" size="sm" onClick={reload} loading={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by node ID, description, or organization"
          className="pl-9"
          aria-label="Search runners"
        />
      </div>

      {error && <AlertMessage type="error" message={error} />}

      <section className="overflow-hidden rounded-md border border-border bg-surface-raised">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{data?.total.toLocaleString() ?? 0} runners</h2>
          {loading && <span className="text-xs text-muted-foreground">Loading...</span>}
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
            title="No runners found"
            description={search ? "Try a different search." : "No runners are registered yet."}
          />
        )}
      </section>

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.total_pages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.total_pages || loading} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={copy?.title ?? ""}
        description={pending ? `${copy?.description} Target: ${pending.runner.node_id}` : undefined}
        variant={copy?.destructive ? "destructive" : "default"}
        confirmText="Confirm"
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
