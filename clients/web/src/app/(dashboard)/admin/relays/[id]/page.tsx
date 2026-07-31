"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import {
  forceUnregisterRelay,
  getRelay,
  type AdminRelay,
} from "@/lib/api/admin/relays";
import { getErrorMessage } from "@/lib/utils";
import { RelayDetailPanel } from "./RelayDetailPanel";

export default function RelayDetailPage() {
  const t = useTranslations("admin");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [relay, setRelay] = useState<AdminRelay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [unregistering, setUnregistering] = useState(false);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getRelay(id)
      .then((result) => {
        if (controller.signal.aborted) return;
        setRelay(result);
        setError(null);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(loadError, t("relays.detail.loadFailed")));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, revision, t]);

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        breadcrumb={
          <Link href="/admin/relays" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            {t("nav.relays")}
          </Link>
        }
        title={relay?.id ?? t("relays.detail.title")}
        subtitle={t("relays.detail.subtitle")}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={reload} loading={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("common.refresh")}
            </Button>
            {relay && (
              <Button
                variant="destructive"
                size="sm"
                disabled={loading || unregistering}
                onClick={() => setConfirming(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("relays.detail.forceUnregister")}
              </Button>
            )}
          </>
        }
      />

      {error && <AlertMessage type="error" message={error} />}
      {loading && !relay ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-md bg-surface-muted" />
          ))}
        </div>
      ) : relay ? (
        <RelayDetailPanel relay={relay} />
      ) : (
        <div className="space-y-3 rounded-md border border-border bg-surface-raised p-4">
          <p className="text-sm text-muted-foreground">
            {t("relays.detail.unavailable")}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reload}>{t("relays.detail.retry")}</Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/relays">{t("relays.detail.backToRelays")}</Link>
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("relays.unregister.title")}
        description={relay ? t("relays.unregister.detailDescription", { id: relay.id }) : undefined}
        variant="destructive"
        confirmText={t("relays.unregister.confirm")}
        loading={unregistering}
        onConfirm={async () => {
          if (!relay) return;
          setUnregistering(true);
          try {
            await forceUnregisterRelay(relay.id);
            toast.success(t("relays.unregister.success"));
            router.push("/admin/relays");
          } catch (actionError) {
            toast.error(getErrorMessage(actionError, t("relays.unregister.failed")));
            throw actionError;
          } finally {
            setUnregistering(false);
          }
        }}
      />
    </div>
  );
}
