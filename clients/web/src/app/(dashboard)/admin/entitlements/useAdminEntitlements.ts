"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  deleteEntitlement,
  denyEntitlement,
  grantEntitlement,
  listOrganizationEntitlements,
  listResourceEntitlements,
  type AdminEntitlementWriteInput,
} from "@/lib/api/admin/entitlements";
import type {
  EntitlementRecord,
  ResourceAccessSummary,
} from "@/lib/api/entitlement/entitlementTypes";
import { getErrorMessage } from "@/lib/utils";
import { summarizeEntitlementRecords } from "./summarizeEntitlementRecords";

export type EntitlementScope =
  | { mode: "resource"; resourceKind: string; resourceKey: string }
  | { mode: "organization"; organizationId: number; resourceKind?: string };

function fetchScope(scope: EntitlementScope): Promise<EntitlementRecord[]> {
  return scope.mode === "resource"
    ? listResourceEntitlements(scope.resourceKind, scope.resourceKey)
    : listOrganizationEntitlements(scope.organizationId, scope.resourceKind);
}

export function useAdminEntitlements(scope: EntitlementScope | null) {
  const t = useTranslations("admin");
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [summaries, setSummaries] = useState<ResourceAccessSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const scopeKey = scope ? JSON.stringify(scope) : "";

  useEffect(() => {
    if (!scope) {
      Promise.resolve().then(() => setSummaries([]));
      return;
    }
    let active = true;
    Promise.resolve().then(() => {
      if (active) setLoading(true);
    });
    fetchScope(scope)
      .then((records) => {
        if (!active) return;
        setSummaries(summarizeEntitlementRecords(records));
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(getErrorMessage(cause, t("entitlements.error.load")));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // scopeKey stands in for the structurally-compared scope object.
  }, [scopeKey, revision, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const write = useCallback(
    async (input: AdminEntitlementWriteInput, effect: "allow" | "deny") => {
      try {
        await (effect === "allow" ? grantEntitlement(input) : denyEntitlement(input));
        toast.success(t("entitlements.toast.saved"));
        reload();
      } catch (cause) {
        toast.error(getErrorMessage(cause, t("entitlements.error.saveFailed")));
        throw cause;
      }
    },
    [reload, t],
  );

  const remove = useCallback(
    async (id: number) => {
      setBusyId(id);
      try {
        await deleteEntitlement(id);
        toast.success(t("entitlements.toast.removed"));
        reload();
      } catch (cause) {
        toast.error(getErrorMessage(cause, t("entitlements.error.removeFailed")));
      } finally {
        setBusyId(null);
      }
    },
    [reload, t],
  );

  return { summaries, loading, error, busyId, reload, write, remove };
}
