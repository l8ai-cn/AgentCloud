"use client";

import Link from "next/link";
import { MoreHorizontal, Power, PowerOff, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminPromoCode } from "@/lib/api/admin/promoTypes";
import type { PromoCodeAction } from "./useAdminPromoCodes";
import {
  formatPromoDate,
  promoStatus,
  promoTypeLabelKeys,
  promoUsageMessage,
} from "./promoCodePresentation";

interface PromoCodeRowProps {
  code: AdminPromoCode;
  busy: boolean;
  onAction: (code: AdminPromoCode, action: PromoCodeAction) => void;
}

export function PromoCodeRow({ code, busy, onAction }: PromoCodeRowProps) {
  const t = useTranslations("admin");
  const status = promoStatus(code);
  const usage = promoUsageMessage(code);
  const promoDate = (value: string | null) =>
    formatPromoDate(value) ?? t("common.never");

  return (
    <div className="grid gap-3 border-b border-border px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1.4fr)_8rem_10rem_12rem_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/promo-codes/${code.id}`}
            className="truncate font-mono text-sm font-semibold hover:text-primary"
          >
            {code.code}
          </Link>
          <Badge variant={status.variant}>{t(status.labelKey)}</Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">{code.name}</p>
      </div>
      <div className="text-xs">
        <p className="font-medium">{t(promoTypeLabelKeys[code.type])}</p>
        <p className="capitalize text-muted-foreground">{code.plan_name}</p>
      </div>
      <div className="text-xs">
        <p className="font-medium">{t(usage.key, usage.values)}</p>
        <p className="text-muted-foreground">
          {t("promoCodes.durationMonths", { count: code.duration_months })}
        </p>
      </div>
      <div className="text-xs">
        <p className="font-medium">
          {t("promoCodes.expiresAt", { date: promoDate(code.expires_at) })}
        </p>
        <p className="text-muted-foreground">
          {t("promoCodes.createdAt", { date: promoDate(code.created_at) })}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            aria-label={t("promoCodes.row.actionsFor", { code: code.code })}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/promo-codes/${code.id}`}>
              {t("promoCodes.row.viewAndEdit")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() =>
              onAction(code, code.is_active ? "deactivate" : "activate")
            }
          >
            {code.is_active ? (
              <PowerOff className="mr-2 h-4 w-4" />
            ) : (
              <Power className="mr-2 h-4 w-4" />
            )}
            {code.is_active
              ? t("promoCodes.action.deactivate")
              : t("promoCodes.action.activate")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => onAction(code, "delete")}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
