"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  getOrganization,
  getOrganizationMembers,
  type AdminOrganization,
  type AdminOrganizationMember,
} from "@/lib/api/admin/organizations";
import { getErrorMessage } from "@/lib/utils";

export function useOrganizationDetail(orgId: number) {
  const t = useTranslations("admin");
  const [result, setResult] = useState<{
    orgId: number;
    organization: AdminOrganization | null;
    members: AdminOrganizationMember[];
    error: string | null;
  }>({ orgId: -1, organization: null, members: [], error: null });

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([getOrganization(orgId), getOrganizationMembers(orgId)])
      .then(([organization, members]) => {
        if (!controller.signal.aborted) {
          setResult({ orgId, organization, members, error: null });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({
            orgId,
            organization: null,
            members: [],
            error: getErrorMessage(error, t("organizations.detailLoadError")),
          });
        }
      });
    return () => controller.abort();
  }, [orgId, t]);

  return {
    organization: result.organization,
    members: result.members,
    error: result.orgId === orgId ? result.error : null,
    loading: result.orgId !== orgId,
  };
}
