"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SupportTicketFilters } from "./SupportTicketFilters";
import { SupportTicketList } from "./SupportTicketList";
import { SupportTicketStats } from "./SupportTicketStats";
import {
  type SupportTicketFilters as Filters,
  useSupportTickets,
} from "./useSupportTickets";

const initialFilters: Filters = {
  search: "",
  status: "all",
  category: "all",
  priority: "all",
};

export default function SupportTicketsPage() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const { data, stats, error, loading, reload } = useSupportTickets(filters, page);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, search: query.trim() }));
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const hasFilters = useMemo(
    () => Object.values(filters).some((value) => value !== "" && value !== "all"),
    [filters],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        title="Support tickets"
        subtitle="Review platform support requests and respond as a system administrator."
        actions={
          <Button variant="outline" size="sm" onClick={reload} loading={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {stats && <SupportTicketStats stats={stats} />}
      <SupportTicketFilters
        query={query}
        filters={filters}
        disabled={loading && !data}
        onQueryChange={setQuery}
        onFilterChange={(key, value) => {
          setFilters((current) => ({ ...current, [key]: value }));
          setPage(1);
        }}
      />
      {error && <AlertMessage type="error" message={error} />}

      <section className="overflow-hidden rounded-md border border-border bg-surface-raised">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">
            {data?.total.toLocaleString() ?? 0} tickets
          </h2>
          {loading && <span className="text-xs text-muted-foreground">Loading...</span>}
        </div>
        <SupportTicketList
          tickets={data?.data ?? []}
          loading={loading}
          hasFilters={hasFilters}
        />
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
    </div>
  );
}
