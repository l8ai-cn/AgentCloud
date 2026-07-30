"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  disableUser,
  enableUser,
  grantAdmin,
  listUsers,
  revokeAdmin,
  unverifyUserEmail,
  verifyUserEmail,
} from "@/lib/api/admin/users";
import type { AdminPaginated, AdminUser } from "@/lib/api/admin/types";
import { getErrorMessage } from "@/lib/utils";

export type UserAction =
  | "disable"
  | "enable"
  | "grant-admin"
  | "revoke-admin"
  | "verify-email"
  | "unverify-email";

const actions: Record<UserAction, (id: number) => Promise<AdminUser>> = {
  disable: disableUser,
  enable: enableUser,
  "grant-admin": grantAdmin,
  "revoke-admin": revokeAdmin,
  "verify-email": verifyUserEmail,
  "unverify-email": unverifyUserEmail,
};

const successMessages: Record<UserAction, string> = {
  disable: "User disabled.",
  enable: "User enabled.",
  "grant-admin": "System administrator access granted.",
  "revoke-admin": "System administrator access revoked.",
  "verify-email": "Email marked as verified.",
  "unverify-email": "Email verification removed.",
};

export function useAdminUsers(search: string, page: number) {
  const [revision, setRevision] = useState(0);
  const requestKey = `${search}\u0000${page}\u0000${revision}`;
  const [result, setResult] = useState<{
    key: string;
    data: AdminPaginated<AdminUser> | null;
    error: string | null;
  }>({ key: "", data: null, error: null });

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    listUsers({ search: search || undefined, page, page_size: 20 })
      .then((result) => {
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, data: result, error: null });
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setResult((current) => ({
            key: requestKey,
            data: current.data,
            error: getErrorMessage(loadError, "Failed to load users."),
          }));
        }
      });
    return () => controller.abort();
  }, [page, requestKey, search]);

  const runAction = useCallback(
    async (action: UserAction, userId: number) => {
      try {
        await actions[action](userId);
        toast.success(successMessages[action]);
        reload();
      } catch (actionError) {
        toast.error(getErrorMessage(actionError, "User update failed."));
        throw actionError;
      }
    },
    [reload],
  );

  return {
    data: result.data,
    loading: result.key !== requestKey,
    error: result.key === requestKey ? result.error : null,
    reload,
    runAction,
  };
}
