"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  deleteMemberEntitlement,
  denyMemberEntitlement,
  grantMemberEntitlement,
  listEntitlements,
} from "@/lib/api/facade/entitlementConnect";
import type {
  MemberEntitlementInput,
  ResourceAccessSummary,
} from "@/lib/api/entitlement/entitlementTypes";
import { getErrorMessage } from "@/lib/utils";

export function useMemberAccessEntitlements(
  orgSlug: string | undefined,
  organizationId: number | undefined,
) {
  const t = useTranslations("settings.memberAccess");
  const [summaries, setSummaries] = useState<ResourceAccessSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!orgSlug || !organizationId) return;
    let active = true;
    setLoading(true);
    listEntitlements(orgSlug, organizationId)
      .then((result) => {
        if (!active) return;
        setSummaries(result.summaries);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (active) setError(getErrorMessage(cause, t("error.load")));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orgSlug, organizationId, revision, t]);

  const write = useCallback(
    async (input: MemberEntitlementInput, effect: "allow" | "deny") => {
      try {
        await (effect === "allow"
          ? grantMemberEntitlement(input)
          : denyMemberEntitlement(input));
        toast.success(t("toast.saved"));
        reload();
      } catch (cause) {
        toast.error(getErrorMessage(cause, t("error.saveFailed")));
        throw cause;
      }
    },
    [reload, t],
  );

  const remove = useCallback(
    async (id: number) => {
      if (!orgSlug) return;
      setBusyId(id);
      try {
        await deleteMemberEntitlement(orgSlug, id);
        toast.success(t("toast.removed"));
        reload();
      } catch (cause) {
        toast.error(getErrorMessage(cause, t("error.removeFailed")));
      } finally {
        setBusyId(null);
      }
    },
    [orgSlug, reload, t],
  );

  return { summaries, loading, error, busyId, reload, write, remove };
}
