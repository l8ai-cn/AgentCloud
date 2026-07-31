"use client";

import { useCallback, useEffect, useState } from "react";
import { Radio, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  forceUnregisterRelay,
  getRelayStats,
  listRelays,
  type AdminRelay,
  type AdminRelayStats,
} from "@/lib/api/admin/relays";
import { getErrorMessage } from "@/lib/utils";
import { RelayRow } from "./RelayRow";

export default function RelaysPage() {
  const t = useTranslations("admin");
  const [revision, setRevision] = useState(0);
  const [relays, setRelays] = useState<AdminRelay[] | null>(null);
  const [stats, setStats] = useState<AdminRelayStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<AdminRelay | null>(null);
  const [busy, setBusy] = useState(false);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([listRelays(), getRelayStats()])
      .then(([inventory, relayStats]) => {
        if (controller.signal.aborted) return;
        setRelays(inventory.data);
        setStats(relayStats);
        setError(null);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(loadError, t("relays.loadFailed")));
        }
      });
    return () => controller.abort();
  }, [revision, t]);

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        title={t("nav.relays")}
        subtitle={t("relays.subtitle")}
        actions={
          <Button variant="outline" size="sm" onClick={reload} loading={relays === null}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("common.refresh")}
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { id: "registered", label: t("relays.stats.registered"), value: stats?.total_relays ?? 0 },
          { id: "healthy", label: t("relays.stats.healthy"), value: stats?.healthy_relays ?? 0 },
          { id: "connections", label: t("relays.stats.connections"), value: stats?.total_connections ?? 0 },
        ].map(({ id, label, value }) => (
          <div key={id} className="border-l-2 border-border pl-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      {error && <AlertMessage type="error" message={error} />}

      <section className="overflow-hidden rounded-md border border-border bg-surface-raised">
        {relays === null ? (
          <div className="space-y-1 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-md bg-surface-muted" />
            ))}
          </div>
        ) : relays.length ? (
          relays.map((relay) => (
            <RelayRow
              key={relay.id}
              relay={relay}
              busy={busy}
              onUnregister={() => setPending(relay)}
            />
          ))
        ) : (
          <EmptyState
            size="compact"
            icon={<Radio className="h-5 w-5" />}
            title={t("relays.empty.title")}
            description={t("relays.empty.description")}
          />
        )}
      </section>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={t("relays.unregister.title")}
        description={pending
          ? t("relays.unregister.listDescription", {
              id: pending.id,
              connections: pending.connections,
            })
          : undefined}
        variant="destructive"
        confirmText={t("relays.unregister.confirm")}
        loading={busy}
        onConfirm={async () => {
          if (!pending) return;
          setBusy(true);
          try {
            await forceUnregisterRelay(pending.id);
            toast.success(t("relays.unregister.success"));
            setPending(null);
            reload();
          } catch (actionError) {
            toast.error(getErrorMessage(actionError, t("relays.unregister.failed")));
            throw actionError;
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
