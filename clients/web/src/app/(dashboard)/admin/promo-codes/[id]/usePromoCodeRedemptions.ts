"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { listPromoCodeRedemptions } from "@/lib/api/admin/promo";
import type {
  AdminPromoCodeRedemption,
  PromoCodePage,
} from "@/lib/api/admin/promoTypes";
import { getErrorMessage } from "@/lib/utils";

export function usePromoCodeRedemptions(id: number, page: number) {
  const t = useTranslations("admin");
  const requestKey = `${id}:${page}`;
  const [result, setResult] = useState<{
    key: string;
    data: PromoCodePage<AdminPromoCodeRedemption> | null;
    error: string | null;
  }>({ key: "", data: null, error: null });

  useEffect(() => {
    if (!Number.isSafeInteger(id) || id <= 0) return;
    const controller = new AbortController();
    listPromoCodeRedemptions(id, { page, page_size: 20 })
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
            error: getErrorMessage(error, t("promoCodes.error.loadRedemptions")),
          }));
        }
      });
    return () => controller.abort();
  }, [id, page, requestKey, t]);

  return {
    data: result.data,
    error: result.key === requestKey ? result.error : null,
    loading: result.key !== requestKey,
  };
}
