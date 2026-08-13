"use client";

import { Ban, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";

import { AccessModeBadges } from "@/components/entitlement/AccessModeBadges";
import { AccessModeExplainer } from "@/components/entitlement/AccessModeExplainer";
import { EntitlementRowList } from "@/components/entitlement/EntitlementRowList";
import { summaryRows } from "@/components/entitlement/entitlementSummaryRows";
import { Button } from "@/components/ui/button";
import type {
  EntitlementRecord,
  ResourceAccessSummary,
} from "@/lib/api/entitlement/entitlementTypes";

interface MemberAccessResourceCardProps {
  summary: ResourceAccessSummary;
  title: string;
  busyId: number | null;
  memberLabel: (userId: number) => string;
  onWrite: (effect: "allow" | "deny") => void;
  onRemove: (record: EntitlementRecord) => void;
}

export function MemberAccessResourceCard({
  summary,
  title,
  busyId,
  memberLabel,
  onWrite,
  onRemove,
}: MemberAccessResourceCardProps) {
  const t = useTranslations("settings.memberAccess");
  const platformRows = summary.org_rows;
  const memberRows = summaryRows(summary).filter((row) => row.subject_kind === "user");

  return (
    <section className="surface-card space-y-3 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{title}</h3>
            <AccessModeBadges summary={summary} />
          </div>
          <AccessModeExplainer summary={summary} />
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={() => onWrite("allow")}>
            <UserPlus className="mr-1 h-3.5 w-3.5" />
            {t("actions.allow")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onWrite("deny")}>
            <Ban className="mr-1 h-3.5 w-3.5" />
            {t("actions.deny")}
          </Button>
        </div>
      </div>

      <EntitlementRowList
        rows={memberRows}
        busyId={busyId}
        resolveSubject={(row) => memberLabel(row.subject_user_id ?? 0)}
        onRemove={onRemove}
      />
      {memberRows.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("noMemberRows")}</p>
      )}
      {/* Platform rows are read-only here: only a system admin can change
          admission, and hiding them makes a revoked resource look like a
          local misconfiguration. */}
      {platformRows.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t("platformRows")}</p>
          <EntitlementRowList
            rows={platformRows}
            busyId={busyId}
            resolveSubject={() => t("platformSubject")}
          />
        </div>
      )}
    </section>
  );
}
