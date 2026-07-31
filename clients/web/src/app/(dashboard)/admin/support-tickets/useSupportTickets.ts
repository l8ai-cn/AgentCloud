"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  getSupportTicketStats,
  listSupportTickets,
} from "@/lib/api/admin/supportTickets";
import type {
  SupportTicketCategory,
  SupportTicketPage,
  SupportTicketPriority,
  SupportTicketStats,
  SupportTicketStatus,
} from "@/lib/api/admin/supportTicketTypes";
import { getErrorMessage } from "@/lib/utils";

export interface SupportTicketFilters {
  search: string;
  status: SupportTicketStatus | "all";
  category: SupportTicketCategory | "all";
  priority: SupportTicketPriority | "all";
}

export function useSupportTickets(filters: SupportTicketFilters, page: number) {
  const t = useTranslations("admin");
  const [revision, setRevision] = useState(0);
  const requestKey = JSON.stringify([filters, page, revision]);
  const [result, setResult] = useState<{
    key: string;
    data: SupportTicketPage | null;
    stats: SupportTicketStats | null;
    error: string | null;
  }>({ key: "", data: null, stats: null, error: null });

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      listSupportTickets({
        search: filters.search || undefined,
        status: filters.status === "all" ? undefined : filters.status,
        category: filters.category === "all" ? undefined : filters.category,
        priority: filters.priority === "all" ? undefined : filters.priority,
        page,
        page_size: 20,
      }),
      getSupportTicketStats(),
    ])
      .then(([data, stats]) => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, data, stats, error: null });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult((current) => ({
            key: requestKey,
            data: current.data,
            stats: current.stats,
            error: getErrorMessage(error, t("support.loadFailed")),
          }));
        }
      });
    return () => controller.abort();
  }, [filters, page, requestKey, t]);

  return {
    data: result.data,
    stats: result.stats,
    error: result.key === requestKey ? result.error : null,
    loading: result.key !== requestKey,
    reload,
  };
}
