"use client";

import { Ban, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { AccessModeBadges } from "@/components/entitlement/AccessModeBadges";
import { AccessModeExplainer } from "@/components/entitlement/AccessModeExplainer";
import { EntitlementRowList } from "@/components/entitlement/EntitlementRowList";
import { summaryRows } from "@/components/entitlement/entitlementSummaryRows";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type {
  EntitlementRecord,
  ResourceAccessSummary,
} from "@/lib/api/entitlement/entitlementTypes";

interface EntitlementSummaryCardProps {
  summary: ResourceAccessSummary;
  title: string;
  subtitle: string;
  busyId: number | null;
  resolveSubject: (record: EntitlementRecord) => string;
  onWrite: (effect: "allow" | "deny") => void;
  onRemove: (record: EntitlementRecord) => void;
}

export function EntitlementSummaryCard({
  summary,
  title,
  subtitle,
  busyId,
  resolveSubject,
  onWrite,
  onRemove,
}: EntitlementSummaryCardProps) {
  const t = useTranslations("admin.entitlements");
  const rows = summaryRows(summary);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{title}</h3>
            <AccessModeBadges summary={summary} />
          </div>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          <AccessModeExplainer summary={summary} />
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={() => onWrite("allow")}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t("actions.grant")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onWrite("deny")}>
            <Ban className="mr-1 h-3.5 w-3.5" />
            {t("actions.deny")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <EntitlementRowList
          rows={rows}
          busyId={busyId}
          resolveSubject={resolveSubject}
          onRemove={onRemove}
        />
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground">{t("emptyRows")}</p>
        )}
        {summary.expired.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">{t("expiredHeading")}</p>
            <EntitlementRowList
              rows={summary.expired}
              busyId={busyId}
              resolveSubject={resolveSubject}
              onRemove={onRemove}
              dimmed
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
