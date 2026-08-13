"use client";

import { Globe2, ListChecks, ShieldBan, ShieldQuestion } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { ResourceAccessSummary } from "@/lib/api/entitlement/entitlementTypes";

interface AccessModeBadgesProps {
  summary: ResourceAccessSummary;
}

/** Two badges, always both shown: the platform admission and the member
 *  access mode. Showing only the second is what makes "no rows at all" and
 *  "revoked by the platform" look identical, which is the misread this
 *  surface exists to prevent. */
export function AccessModeBadges({ summary }: AccessModeBadgesProps) {
  const t = useTranslations("entitlement");

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {summary.org_admission === "revoked" ? (
        <Badge variant="destructive" className="gap-1">
          <ShieldBan className="h-3 w-3" />
          {t("admission.revoked")}
        </Badge>
      ) : summary.org_admission === "admitted" ? (
        <Badge variant="success" className="gap-1">
          <ShieldQuestion className="h-3 w-3" />
          {t("admission.admitted")}
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1">
          <ShieldQuestion className="h-3 w-3" />
          {t("admission.unset")}
        </Badge>
      )}

      {summary.member_access === "everyone" ? (
        <Badge variant="info" className="gap-1">
          <Globe2 className="h-3 w-3" />
          {t("memberAccess.everyone")}
        </Badge>
      ) : (
        <Badge variant="warning" className="gap-1">
          <ListChecks className="h-3 w-3" />
          {t("memberAccess.allowList", { count: summary.allowed.length })}
        </Badge>
      )}

      {summary.denied.length > 0 && (
        <Badge variant="destructive" className="gap-1">
          <ShieldBan className="h-3 w-3" />
          {t("memberAccess.denied", { count: summary.denied.length })}
        </Badge>
      )}
    </div>
  );
}
