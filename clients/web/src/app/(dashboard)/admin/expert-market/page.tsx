"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import {
  approveExpertRelease,
  getExpertRelease,
  listExpertReleases,
  rejectExpertRelease,
  type ExpertRelease,
  type ExpertReleaseStatus,
} from "@/lib/api/admin/expertMarket";
import { getErrorMessage } from "@/lib/utils";
import { ExpertReleaseDetail } from "./ExpertReleaseDetail";
import { ExpertReleaseList } from "./ExpertReleaseList";
import { ExpertReleasePagination } from "./ExpertReleasePagination";
import {
  expertReleaseStatusLabelKeys,
  expertReleaseStatuses,
} from "./expertReleaseStatusLabels";

const PAGE_SIZE = 20;

export default function ExpertMarketPage() {
  const t = useTranslations("admin");
  const [status, setStatus] = useState<ExpertReleaseStatus>("pending");
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<{
    releases: ExpertRelease[];
    total: number;
    limit: number;
    offset: number;
  } | null>(null);
  const [selected, setSelected] = useState<ExpertRelease | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    listExpertReleases(status, PAGE_SIZE, offset)
      .then((result) => {
        if (!controller.signal.aborted) {
          if (result.data.length === 0 && offset > 0 && result.total <= offset) {
            setOffset(Math.max(0, offset - PAGE_SIZE));
            return;
          }
          setData({
            releases: result.data,
            total: result.total,
            limit: result.limit,
            offset: result.offset,
          });
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(loadError, t("expertMarket.loadFailed")));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [offset, revision, status, t]);

  const act = async () => {
    if (!selected || !pendingAction) return;
    setBusy(true);
    try {
      const updated = pendingAction === "approve"
        ? await approveExpertRelease(selected.id)
        : await rejectExpertRelease(selected.id, reason.trim());
      setSelected(updated);
      setReason("");
      setPendingAction(null);
      toast.success(
        pendingAction === "approve"
          ? t("expertMarket.approved")
          : t("expertMarket.rejected"),
      );
      reload();
    } catch (actionError) {
      toast.error(getErrorMessage(actionError, t("expertMarket.actionFailed")));
      throw actionError;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        title={t("expertMarket.title")}
        subtitle={t("expertMarket.subtitle")}
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="mr-2 h-4 w-4" />{t("common.refresh")}</Button>}
      />
      <div className="flex max-w-full gap-1 overflow-x-auto border-b border-border">
        {expertReleaseStatuses.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={status === item ? "secondary" : "ghost"}
            onClick={() => {
              setStatus(item);
              setOffset(0);
              setData(null);
              setSelected(null);
              setReason("");
            }}
          >
            {t(expertReleaseStatusLabelKeys[item])}
          </Button>
        ))}
      </div>
      {error && <AlertMessage type="error" message={error} />}
      <p className="text-sm text-muted-foreground">
        {t("expertMarket.releaseCount", { count: data?.total ?? 0 })}
      </p>
      <ExpertReleaseList
        releases={data?.releases ?? []}
        loading={loading && data === null && !error}
        onSelect={async (id) => {
          try {
            setSelected(await getExpertRelease(id));
            setReason("");
          } catch (detailError) {
            toast.error(getErrorMessage(detailError, t("expertMarket.loadDetailFailed")));
          }
        }}
      />
      <ExpertReleasePagination
        total={data?.total ?? 0}
        limit={data?.limit ?? PAGE_SIZE}
        offset={data?.offset ?? offset}
        loading={loading}
        onPrevious={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
        onNext={() => setOffset((value) => value + PAGE_SIZE)}
      />
      {selected && (
        <ExpertReleaseDetail
          release={selected}
          reason={reason}
          busy={busy}
          onReasonChange={setReason}
          onApprove={() => setPendingAction("approve")}
          onReject={() => setPendingAction("reject")}
        />
      )}
      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={pendingAction === "approve"
          ? t("expertMarket.approveConfirmTitle")
          : t("expertMarket.rejectConfirmTitle")}
        description={pendingAction === "approve"
          ? t("expertMarket.approveConfirmDescription")
          : reason.trim()}
        variant={pendingAction === "reject" ? "destructive" : "default"}
        confirmText={pendingAction === "approve"
          ? t("expertMarket.approve")
          : t("expertMarket.reject")}
        loading={busy}
        onConfirm={act}
      />
    </div>
  );
}
