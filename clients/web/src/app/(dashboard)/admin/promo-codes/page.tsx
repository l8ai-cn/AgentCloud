"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import type {
  AdminPromoCode,
  AdminPromoCodeListParams,
} from "@/lib/api/admin/promoTypes";
import { PromoCodeFilters } from "./PromoCodeFilters";
import type {
  PromoPlanFilter,
  PromoStatusFilter,
  PromoTypeFilter,
} from "./PromoCodeFilters";
import { PromoCodeList } from "./PromoCodeList";
import {
  type PromoCodeAction,
  useAdminPromoCodes,
} from "./useAdminPromoCodes";

const actionCopy: Record<PromoCodeAction, { title: string; description: string }> = {
  activate: {
    title: "Activate this promo code?",
    description: "Eligible organizations will be able to redeem it immediately.",
  },
  deactivate: {
    title: "Deactivate this promo code?",
    description: "New redemptions will stop until the code is activated again.",
  },
  delete: {
    title: "Delete this promo code?",
    description: "Deletion is permanent and the backend rejects codes with redemptions.",
  },
};

export default function AdminPromoCodesPage() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<PromoTypeFilter>("all");
  const [plan, setPlan] = useState<PromoPlanFilter>("all");
  const [status, setStatus] = useState<PromoStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<{
    code: AdminPromoCode;
    action: PromoCodeAction;
  } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const params = useMemo<AdminPromoCodeListParams>(
    () => ({
      search: search || undefined,
      type: type === "all" ? undefined : type,
      plan_name: plan === "all" ? undefined : plan,
      is_active: status === "all" ? undefined : status === "active",
      page,
      page_size: 20,
    }),
    [page, plan, search, status, type],
  );
  const { data, loading, error, busyId, reload, runAction } =
    useAdminPromoCodes(params);
  const searching =
    Boolean(search) || type !== "all" || plan !== "all" || status !== "all";

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        title="Promo codes"
        subtitle="Create and control subscription access codes across the platform."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={reload} loading={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/promo-codes/new">
                <Plus className="mr-2 h-4 w-4" />
                Create code
              </Link>
            </Button>
          </>
        }
      />

      <PromoCodeFilters
        query={query}
        type={type}
        plan={plan}
        status={status}
        disabled={loading && !data}
        onQueryChange={setQuery}
        onTypeChange={(value) => {
          setType(value);
          setPage(1);
        }}
        onPlanChange={(value) => {
          setPlan(value);
          setPage(1);
        }}
        onStatusChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
      />

      {error && <AlertMessage type="error" message={error} />}

      <section className="overflow-hidden rounded-md border border-border bg-surface-raised">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">
            {data?.total.toLocaleString() ?? 0} promo codes
          </h2>
          {loading && <span className="text-xs text-muted-foreground">Loading...</span>}
        </div>
        <PromoCodeList
          codes={data?.data ?? []}
          loading={loading}
          searching={searching}
          busyId={busyId}
          onAction={(code, action) => setPending({ code, action })}
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

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending ? actionCopy[pending.action].title : ""}
        description={
          pending
            ? `${actionCopy[pending.action].description} Target: ${pending.code.code}`
            : undefined
        }
        variant={pending?.action === "delete" ? "destructive" : "default"}
        confirmText={pending?.action === "delete" ? "Delete code" : "Confirm"}
        loading={pending ? busyId === pending.code.id : false}
        onConfirm={async () => {
          if (!pending) return;
          await runAction(pending.action, pending.code.id);
          setPending(null);
        }}
      />
    </div>
  );
}
