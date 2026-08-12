"use client";

import { Info } from "lucide-react";
import { useTranslations } from "next-intl";

import type { ResourceAccessSummary } from "@/lib/api/entitlement/entitlementTypes";

interface AccessModeExplainerProps {
  summary: ResourceAccessSummary;
}

/** Spells out who can actually use the resource right now. The badge alone
 *  reads as a status; admins act on the sentence. */
export function AccessModeExplainer({ summary }: AccessModeExplainerProps) {
  const t = useTranslations("admin.entitlements");

  const message =
    summary.org_admission === "revoked"
      ? t("explain.revoked")
      : summary.member_access === "everyone"
        ? t("explain.everyone")
        : t("explain.allowList", { count: summary.allowed.length });

  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        {message}
        {summary.denied.length > 0 && ` ${t("explain.denyOutranks", { count: summary.denied.length })}`}
      </span>
    </p>
  );
}
