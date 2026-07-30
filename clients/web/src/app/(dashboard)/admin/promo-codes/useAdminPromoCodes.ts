"use client";

import { useCallback, useEffect, useState } from "react";
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

const successMessages: Record<PromoCodeAction, string> = {
  activate: "Promo code activated.",
  deactivate: "Promo code deactivated.",
  delete: "Promo code deleted.",
};

export function useAdminPromoCodes(params: AdminPromoCodeListParams) {
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
            error: getErrorMessage(error, "Failed to load promo codes."),
          }));
        }
      });
    return () => controller.abort();
  }, [params, requestKey]);

  const runAction = useCallback(
    async (action: PromoCodeAction, id: number) => {
      setBusyId(id);
      try {
        await actions[action](id);
        toast.success(successMessages[action]);
        reload();
      } catch (error) {
        toast.error(getErrorMessage(error, "Promo code update failed."));
        throw error;
      } finally {
        setBusyId(null);
      }
    },
    [reload],
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
