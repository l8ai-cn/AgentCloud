"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, RefreshCw, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CenteredSpinner } from "@/components/ui/spinner";
import { PartnerStatisticsDashboard } from "@/components/experts/PartnerStatisticsDashboard";
import type { Expert } from "@/lib/api/expertApi";
import { fetchAllExperts } from "@/lib/api/expert-list-pagination";
import { buildPartnerStatistics } from "@/lib/partner-statistics-model";

export default function PartnerStatisticsPage() {
  const t = useTranslations("experts");
  const ts = useTranslations("partnerStatistics");
  const params = useParams();
  const orgSlug = String(params.org ?? "");
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const nextExperts = await fetchAllExperts(orgSlug, controller.signal);
      if (!controller.signal.aborted) setExperts(nextExperts);
    } catch (loadError) {
      if (controller.signal.aborted) return;
      setExperts([]);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, [orgSlug]);

  useEffect(() => {
    void load();
    return () => requestRef.current?.abort();
  }, [load]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title={ts("title")}
        subtitle={ts("description")}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw
                className={loading
                  ? "h-4 w-4 animate-spin motion-reduce:animate-none"
                  : "h-4 w-4"}
              />
              {ts("refresh")}
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link href={`/${orgSlug}/experts/new`}>
                <Plus className="h-4 w-4" />
                {t("createExpert")}
              </Link>
            </Button>
          </>
        }
      />

      {loading && experts.length === 0 && <CenteredSpinner className="flex-1" />}
      {!loading && error && (
        <EmptyState
          size="full"
          icon={<UsersRound className="h-12 w-12" />}
          title={ts("loadFailed")}
          description={error}
          actions={
            <Button variant="outline" onClick={() => void load()}>
              {t("retry")}
            </Button>
          }
        />
      )}
      {!loading && !error && experts.length === 0 && (
        <EmptyState
          size="full"
          icon={<UsersRound className="h-12 w-12" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          actions={
            <Button asChild>
              <Link href={`/${orgSlug}/experts/new`}>{t("createExpert")}</Link>
            </Button>
          }
        />
      )}
      {!error && experts.length > 0 && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-6xl">
            <PartnerStatisticsDashboard
              orgSlug={orgSlug}
              statistics={buildPartnerStatistics(experts)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
