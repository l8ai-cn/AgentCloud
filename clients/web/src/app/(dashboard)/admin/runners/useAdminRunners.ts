"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  deleteRunner,
  disableRunner,
  enableRunner,
  listRunners,
  type AdminRunner,
} from "@/lib/api/admin/runners";
import type { AdminPaginated } from "@/lib/api/admin/types";
import { getErrorMessage } from "@/lib/utils";

export type RunnerAction = "disable" | "enable" | "delete";

const actions: Record<RunnerAction, (id: number) => Promise<unknown>> = {
  disable: disableRunner,
  enable: enableRunner,
  delete: deleteRunner,
};

export function useAdminRunners(search: string, page: number) {
  const t = useTranslations("admin");
  const [revision, setRevision] = useState(0);
  const requestKey = `${search}\u0000${page}\u0000${revision}`;
  const [result, setResult] = useState<{
    key: string;
    data: AdminPaginated<AdminRunner> | null;
    error: string | null;
  }>({ key: "", data: null, error: null });
  const [mutating, setMutating] = useState(false);

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    listRunners({ search: search || undefined, page, page_size: 20 })
      .then((data) => {
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, data, error: null });
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setResult((current) => ({
            key: requestKey,
            data: current.data,
            error: getErrorMessage(loadError, t("runners.loadFailed")),
          }));
        }
      });
    return () => controller.abort();
  }, [page, requestKey, search, t]);

  const runAction = useCallback(
    async (action: RunnerAction, runnerId: number) => {
      setMutating(true);
      const successMessages: Record<RunnerAction, string> = {
        disable: t("runners.toast.disabled"),
        enable: t("runners.toast.enabled"),
        delete: t("runners.toast.deleted"),
      };
      try {
        await actions[action](runnerId);
        toast.success(successMessages[action]);
        reload();
      } catch (actionError) {
        toast.error(getErrorMessage(actionError, t("runners.updateFailed")));
        throw actionError;
      } finally {
        setMutating(false);
      }
    },
    [reload, t],
  );

  return {
    data: result.data,
    loading: result.key !== requestKey,
    error: result.key === requestKey ? result.error : null,
    mutating,
    reload,
    runAction,
  };
}
