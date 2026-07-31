"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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

const successKeys: Record<UserAction, string> = {
  disable: "disabled",
  enable: "enabled",
  "grant-admin": "adminGranted",
  "revoke-admin": "adminRevoked",
  "verify-email": "emailVerified",
  "unverify-email": "emailUnverified",
};

export function useAdminUsers(search: string, page: number) {
  const t = useTranslations("admin");
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
            error: getErrorMessage(loadError, t("users.errors.load")),
          }));
        }
      });
    return () => controller.abort();
  }, [page, requestKey, search, t]);

  const runAction = useCallback(
    async (action: UserAction, userId: number) => {
      try {
        await actions[action](userId);
        toast.success(t(`users.toast.${successKeys[action]}`));
        reload();
      } catch (actionError) {
        toast.error(getErrorMessage(actionError, t("users.errors.action")));
        throw actionError;
      }
    },
    [reload, t],
  );

  return {
    data: result.data,
    loading: result.key !== requestKey,
    error: result.key === requestKey ? result.error : null,
    reload,
    runAction,
  };
}
