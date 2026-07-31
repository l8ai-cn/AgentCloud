"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { getPromoCode } from "@/lib/api/admin/promo";
import type { AdminPromoCode } from "@/lib/api/admin/promoTypes";
import { getErrorMessage } from "@/lib/utils";

export function usePromoCodeDetail(id: number) {
  const t = useTranslations("admin");
  const [revision, setRevision] = useState(0);
  const requestKey = `${id}:${revision}`;
  const [result, setResult] = useState<{
    key: string;
    code: AdminPromoCode | null;
    error: string | null;
  }>({ key: "", code: null, error: null });

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!Number.isSafeInteger(id) || id <= 0) return;
    const controller = new AbortController();
    getPromoCode(id)
      .then((code) => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, code, error: null });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            key: requestKey,
            code: null,
            error: getErrorMessage(error, t("promoCodes.error.loadDetail")),
          });
        }
      });
    return () => controller.abort();
  }, [id, requestKey, t]);

  return {
    code: result.code,
    error: result.key === requestKey ? result.error : null,
    loading: result.key !== requestKey,
    reload,
  };
}
