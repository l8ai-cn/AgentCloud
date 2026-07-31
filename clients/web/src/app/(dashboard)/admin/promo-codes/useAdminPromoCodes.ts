"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  activatePromoCode,
  deactivatePromoCode,
  deletePromoCode,
  listPromoCodes,
} from "@/lib/api/admin/promo";
import type {
  AdminPromoCode,
  AdminPromoCodeListParams,
  PromoCodePage,
} from "@/lib/api/admin/promoTypes";
import { getErrorMessage } from "@/lib/utils";

export type PromoCodeAction = "activate" | "deactivate" | "delete";

const actions: Record<PromoCodeAction, (id: number) => Promise<unknown>> = {
  activate: activatePromoCode,
  deactivate: deactivatePromoCode,
  delete: deletePromoCode,
};

const successKeys: Record<PromoCodeAction, string> = {
  activate: "promoCodes.toast.activated",
  deactivate: "promoCodes.toast.deactivated",
  delete: "promoCodes.toast.deleted",
};

export function useAdminPromoCodes(params: AdminPromoCodeListParams) {
  const t = useTranslations("admin");
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const requestKey = JSON.stringify({ ...params, revision });
  const [result, setResult] = useState<{
    key: string;
    data: PromoCodePage<AdminPromoCode> | null;
    error: string | null;
  }>({ key: "", data: null, error: null });

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    listPromoCodes(params)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, data, error: null });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult((current) => ({
            key: requestKey,
            data: current.data,
            error: getErrorMessage(error, t("promoCodes.error.load")),
          }));
        }
      });
    return () => controller.abort();
  }, [params, requestKey, t]);

  const runAction = useCallback(
    async (action: PromoCodeAction, id: number) => {
      setBusyId(id);
      try {
        await actions[action](id);
        toast.success(t(successKeys[action]));
        reload();
      } catch (error) {
        toast.error(getErrorMessage(error, t("promoCodes.error.actionFailed")));
        throw error;
      } finally {
        setBusyId(null);
      }
    },
    [reload, t],
  );

  return {
    data: result.data,
    loading: result.key !== requestKey,
    error: result.key === requestKey ? result.error : null,
    busyId,
    reload,
    runAction,
  };
}
