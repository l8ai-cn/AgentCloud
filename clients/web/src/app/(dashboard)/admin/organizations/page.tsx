"use client";

import { useEffect, useState } from "react";
import { Building2, RefreshCw, Search } from "lucide-react";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import type { AdminOrganization } from "@/lib/api/admin/organizations";
import { OrganizationRow } from "./OrganizationRow";
import { useOrganizations } from "./useOrganizations";

export default function OrganizationsPage() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<AdminOrganization | null>(null);
  const { data, error, loading, reload, remove } = useOrganizations(search, page);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        title="Organizations"
        subtitle="Inspect tenant membership, subscriptions, quotas, and execution capacity."
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
          placeholder="Search organizations"
          aria-label="Search organizations"
          className="pl-9"
        />
      </div>

      {error && <AlertMessage type="error" message={error} />}

      <section className="overflow-hidden rounded-md border border-border bg-surface-raised">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">
            {data?.total.toLocaleString() ?? 0} organizations
          </h2>
          {loading && <span className="text-xs text-muted-foreground">Loading...</span>}
        </div>
        {loading && !data ? (
          <div className="space-y-1 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-md bg-surface-muted" />
            ))}
          </div>
        ) : data?.data.length ? (
          data.data.map((organization) => (
            <OrganizationRow
              key={organization.id}
              organization={organization}
              onDelete={() => setPendingDelete(organization)}
            />
          ))
        ) : (
          <EmptyState
            size="compact"
            icon={<Building2 className="h-5 w-5" />}
            title="No organizations found"
            description={search ? "Try a different search." : "No tenant organizations exist yet."}
          />
        )}
      </section>

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {data.page} of {data.total_pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.total_pages || loading} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this organization?"
        description={pendingDelete ? `${pendingDelete.name} and its tenant-owned resources will be permanently deleted.` : undefined}
        variant="destructive"
        confirmText="Delete organization"
        onConfirm={async () => {
          if (!pendingDelete) return;
          await remove(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
