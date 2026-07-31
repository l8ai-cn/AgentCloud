"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useSearchPagination } from "@/hooks/useSearchPagination";
import { SupportTicketFilters } from "./SupportTicketFilters";
import { SupportTicketList } from "./SupportTicketList";
import { SupportTicketStats } from "./SupportTicketStats";
import {
  type SupportTicketFilters as Filters,
  useSupportTickets,
} from "./useSupportTickets";

type FilterSelection = Omit<Filters, "search">;

const initialSelection: FilterSelection = {
  status: "all",
  category: "all",
  priority: "all",
};

export default function SupportTicketsPage() {
  const t = useTranslations("admin");
  const { query, setQuery, search, page, setPage } = useSearchPagination();
  const [selection, setSelection] = useState(initialSelection);
  const filters = useMemo<Filters>(() => ({ ...selection, search }), [selection, search]);
  const { data, stats, error, loading, reload } = useSupportTickets(filters, page);

  const hasFilters = useMemo(
    () => Object.values(filters).some((value) => value !== "" && value !== "all"),
    [filters],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        title={t("support.title")}
        subtitle={t("support.subtitle")}
        actions={
          <Button variant="outline" size="sm" onClick={reload} loading={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("common.refresh")}
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
          setSelection((current) => ({ ...current, [key]: value }));
          setPage(1);
        }}
      />
      {error && <AlertMessage type="error" message={error} />}

      <section className="overflow-hidden rounded-md border border-border bg-surface-raised">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">
            {t("support.ticketCount", { count: data?.total.toLocaleString() ?? 0 })}
          </h2>
          {loading && (
            <span className="text-xs text-muted-foreground">{t("common.loading")}</span>
          )}
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
            {t("common.pageOf", { page: data.page, total: data.total_pages })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>{t("common.previous")}</Button>
            <Button variant="outline" size="sm" disabled={page >= data.total_pages || loading} onClick={() => setPage((value) => value + 1)}>{t("common.next")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
