"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Power, PowerOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import {
  activatePromoCode,
  deactivatePromoCode,
  deletePromoCode,
  updatePromoCode,
} from "@/lib/api/admin/promo";
import type { UpdateAdminPromoCodeInput } from "@/lib/api/admin/promoTypes";
import { getErrorMessage } from "@/lib/utils";
import { EditPromoCodeForm } from "./EditPromoCodeForm";
import { PromoCodeRedemptions } from "./PromoCodeRedemptions";
import { PromoCodeSummary } from "./PromoCodeSummary";
import { usePromoCodeDetail } from "./usePromoCodeDetail";
import { usePromoCodeRedemptions } from "./usePromoCodeRedemptions";

type LifecycleAction = "activate" | "deactivate" | "delete";

export default function PromoCodeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const promoCodeId = Number(id);
  const router = useRouter();
  const [redemptionPage, setRedemptionPage] = useState(1);
  const [pending, setPending] = useState<LifecycleAction | null>(null);
  const [busy, setBusy] = useState<LifecycleAction | "save" | null>(null);
  const { code, error, loading, reload } = usePromoCodeDetail(promoCodeId);
  const redemptions = usePromoCodeRedemptions(promoCodeId, redemptionPage);

  if (!Number.isSafeInteger(promoCodeId) || promoCodeId <= 0) {
    return <AlertMessage type="error" message="Invalid promo code identifier." />;
  }
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-md bg-surface-muted" />
        <div className="h-32 animate-pulse rounded-md bg-surface-muted" />
        <div className="h-64 animate-pulse rounded-md bg-surface-muted" />
      </div>
    );
  }
  if (error || !code) {
    return (
      <div className="space-y-4">
        <AlertMessage type="error" message={error ?? "Promo code not found."} />
        <Button asChild variant="outline">
          <Link href="/admin/promo-codes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to promo codes
          </Link>
        </Button>
      </div>
    );
  }

  const runLifecycleAction = async (action: LifecycleAction) => {
    setBusy(action);
    try {
      if (action === "delete") {
        await deletePromoCode(code.id);
        toast.success("Promo code deleted.");
        router.push("/admin/promo-codes");
        return;
      }
      await (action === "activate"
        ? activatePromoCode(code.id)
        : deactivatePromoCode(code.id));
      toast.success(
        action === "activate"
          ? "Promo code activated."
          : "Promo code deactivated.",
      );
      reload();
    } catch (actionError) {
      toast.error(getErrorMessage(actionError, "Promo code update failed."));
      throw actionError;
    } finally {
      setBusy(null);
    }
  };

  const save = async (input: UpdateAdminPromoCodeInput) => {
    setBusy("save");
    try {
      await updatePromoCode(code.id, input);
      toast.success("Promo code updated.");
      reload();
    } catch (saveError) {
      toast.error(getErrorMessage(saveError, "Failed to update promo code."));
      throw saveError;
    } finally {
      setBusy(null);
    }
  };

  const hasRedemptions = (redemptions.data?.total ?? 0) > 0;
  const action = code.is_active ? "deactivate" : "activate";

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        breadcrumb={
          <Link href="/admin/promo-codes" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-3 w-3" />
            Promo codes
          </Link>
        }
        title={<span className="font-mono">{code.code}</span>}
        subtitle={code.name}
        actions={
          <>
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => setPending(action)}>
              {code.is_active ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
              {code.is_active ? "Deactivate" : "Activate"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={busy !== null || hasRedemptions}
              title={hasRedemptions ? "Codes with redemptions cannot be deleted" : "Delete promo code"}
              onClick={() => setPending("delete")}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </>
        }
      />

      <PromoCodeSummary code={code} />
      <EditPromoCodeForm key={code.updated_at} code={code} saving={busy === "save"} onSubmit={save} />
      <PromoCodeRedemptions
        data={redemptions.data}
        loading={redemptions.loading}
        error={redemptions.error}
        page={redemptionPage}
        onPageChange={setRedemptionPage}
      />

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending === "delete" ? "Delete this promo code?" : `${pending === "activate" ? "Activate" : "Deactivate"} this promo code?`}
        description={pending === "delete" ? `${code.code} will be permanently deleted. The backend rejects deletion if redemptions exist.` : `${code.code} will ${pending === "activate" ? "accept new redemptions" : "stop accepting new redemptions"}.`}
        variant={pending === "delete" ? "destructive" : "default"}
        confirmText={pending === "delete" ? "Delete code" : "Confirm"}
        loading={pending !== null && busy === pending}
        onConfirm={async () => {
          if (!pending) return;
          await runLifecycleAction(pending);
          setPending(null);
        }}
      />
    </div>
  );
}
