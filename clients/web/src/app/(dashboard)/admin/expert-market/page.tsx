"use client";

import { useCallback, useEffect, useState } from "react";
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

const statuses: ExpertReleaseStatus[] = ["pending", "published", "rejected", "withdrawn"];
const PAGE_SIZE = 20;

export default function ExpertMarketPage() {
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
          setError(getErrorMessage(loadError, "Failed to load expert releases."));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [offset, revision, status]);

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
      toast.success(pendingAction === "approve" ? "Release approved." : "Release rejected.");
      reload();
    } catch (actionError) {
      toast.error(getErrorMessage(actionError, "Review action failed."));
      throw actionError;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        title="Expert market"
        subtitle="Review publishable expert snapshots and their runtime dependencies."
        actions={<Button variant="outline" size="sm" onClick={reload}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>}
      />
      <div className="flex max-w-full gap-1 overflow-x-auto border-b border-border">
        {statuses.map((item) => (
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
            {item}
          </Button>
        ))}
      </div>
      {error && <AlertMessage type="error" message={error} />}
      <p className="text-sm text-muted-foreground">{data?.total ?? 0} releases</p>
      <ExpertReleaseList
        releases={data?.releases ?? []}
        loading={loading && data === null && !error}
        onSelect={async (id) => {
          try {
            setSelected(await getExpertRelease(id));
            setReason("");
          } catch (detailError) {
            toast.error(getErrorMessage(detailError, "Failed to load release."));
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
        title={pendingAction === "approve" ? "Approve this release?" : "Reject this release?"}
        description={pendingAction === "approve"
          ? "The release will become available in the expert market."
          : reason.trim()}
        variant={pendingAction === "reject" ? "destructive" : "default"}
        confirmText={pendingAction === "approve" ? "Approve" : "Reject"}
        loading={busy}
        onConfirm={act}
      />
    </div>
  );
}
