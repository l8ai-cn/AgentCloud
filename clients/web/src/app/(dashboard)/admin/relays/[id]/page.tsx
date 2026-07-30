"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Trash2 } from "lucide-react";
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
          setError(getErrorMessage(loadError, "Failed to load relay."));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, revision]);

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        breadcrumb={
          <Link href="/admin/relays" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Relays
          </Link>
        }
        title={relay?.id ?? "Relay details"}
        subtitle="Live registration and health data reported by the backend."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={reload} loading={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {relay && (
              <Button
                variant="destructive"
                size="sm"
                disabled={loading || unregistering}
                onClick={() => setConfirming(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Force unregister
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
            This relay is unavailable or has already been unregistered.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reload}>Retry</Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/relays">Back to relays</Link>
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Force unregister this relay?"
        description={relay
          ? `${relay.id} will be removed from the backend relay roster. Existing connections may be interrupted.`
          : undefined}
        variant="destructive"
        confirmText="Unregister relay"
        loading={unregistering}
        onConfirm={async () => {
          if (!relay) return;
          setUnregistering(true);
          try {
            await forceUnregisterRelay(relay.id);
            toast.success("Relay unregistered.");
            router.push("/admin/relays");
          } catch (actionError) {
            toast.error(getErrorMessage(actionError, "Failed to unregister relay."));
            throw actionError;
          } finally {
            setUnregistering(false);
          }
        }}
      />
    </div>
  );
}
