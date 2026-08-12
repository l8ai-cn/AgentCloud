"use client";

import { Building2, Check, Clock, User, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EntitlementRecord } from "@/lib/api/entitlement/entitlementTypes";

interface EntitlementRowListProps {
  rows: EntitlementRecord[];
  busyId: number | null;
  resolveSubject: (record: EntitlementRecord) => string;
  onRemove?: (record: EntitlementRecord) => void;
  dimmed?: boolean;
}

export function EntitlementRowList({
  rows,
  busyId,
  resolveSubject,
  onRemove,
  dimmed,
}: EntitlementRowListProps) {
  const t = useTranslations("admin.entitlements");

  if (rows.length === 0) return null;

  return (
    <ul className="divide-y divide-border/60 rounded-md border border-border/60">
      {rows.map((row) => (
        <li
          key={row.id}
          className={`flex items-center justify-between gap-3 px-3 py-2 ${dimmed ? "opacity-60" : ""}`}
        >
          <div className="flex min-w-0 items-center gap-2">
            {row.subject_kind === "org" ? (
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{resolveSubject(row)}</p>
              {row.reason && (
                <p className="truncate text-xs text-muted-foreground">{row.reason}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {row.expires_at && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(row.expires_at).toLocaleDateString()}
              </span>
            )}
            <Badge
              variant={row.effect === "deny" ? "destructive" : "success"}
              className="gap-1"
            >
              {row.effect === "deny" ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
              {row.effect === "deny" ? t("effect.deny") : t("effect.allow")}
            </Badge>
            {onRemove && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                aria-label={`${t("actions.remove")}: ${resolveSubject(row)}`}
                loading={busyId === row.id}
                onClick={() => onRemove(row)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
