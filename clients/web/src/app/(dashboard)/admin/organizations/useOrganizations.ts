"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  deleteOrganization,
  listOrganizations,
  type AdminOrganization,
} from "@/lib/api/admin/organizations";
import type { AdminPaginated } from "@/lib/api/admin/types";
import { getErrorMessage } from "@/lib/utils";

export function useOrganizations(search: string, page: number) {
  const [revision, setRevision] = useState(0);
  const requestKey = `${search}\u0000${page}\u0000${revision}`;
  const [result, setResult] = useState<{
    key: string;
    data: AdminPaginated<AdminOrganization> | null;
    error: string | null;
  }>({ key: "", data: null, error: null });

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    listOrganizations({ search: search || undefined, page, page_size: 20 })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult((current) => ({
            key: requestKey,
            data: current.data,
            error: getErrorMessage(error, "Failed to load organizations."),
          }));
        }
      });
    return () => controller.abort();
  }, [page, requestKey, search]);

  const remove = useCallback(async (organization: AdminOrganization) => {
    try {
      await deleteOrganization(organization.id);
      toast.success("Organization deleted.");
      reload();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete organization."));
      throw error;
    }
  }, [reload]);

  return {
    data: result.data,
    error: result.key === requestKey ? result.error : null,
    loading: result.key !== requestKey,
    reload,
    remove,
  };
}
