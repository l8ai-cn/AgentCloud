"use client";

import { type SetStateAction, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { listRunners, type AdminRunner } from "@/lib/api/admin/runners";
import type { AdminPaginated } from "@/lib/api/admin/types";
import { getErrorMessage } from "@/lib/utils";

const PAGE_SIZE = 10;

export function useOrganizationRunners(orgId: number) {
  const t = useTranslations("admin");
  const [pagination, setPagination] = useState({ orgId, page: 1 });
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<{
    requestKey: string;
    data: AdminPaginated<AdminRunner> | null;
    error: string | null;
  }>({ requestKey: "", data: null, error: null });
  const page = pagination.orgId === orgId ? pagination.page : 1;
  const requestKey = `${orgId}:${page}:${reloadKey}`;

  useEffect(() => {
    let active = true;

    listRunners({ org_id: orgId, page, page_size: PAGE_SIZE })
      .then((result) => {
        if (active) {
          setResult({ requestKey, data: result, error: null });
        }
      })
      .catch((loadError) => {
        if (active) {
          setResult({
            requestKey,
            data: null,
            error: getErrorMessage(loadError, t("organizations.runnersLoadError")),
          });
        }
      });

    return () => {
      active = false;
    };
  }, [orgId, page, requestKey, t]);

  const setPage = useCallback(
    (nextPage: SetStateAction<number>) => {
      setPagination((current) => {
        const currentPage = current.orgId === orgId ? current.page : 1;
        return {
          orgId,
          page: typeof nextPage === "function" ? nextPage(currentPage) : nextPage,
        };
      });
    },
    [orgId],
  );

  const reload = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  const current = result.requestKey === requestKey;
  return {
    data: current ? result.data : null,
    error: current ? result.error : null,
    loading: !current,
    page,
    setPage,
    reload,
  };
}
