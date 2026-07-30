"use client";

import Link from "next/link";
import { MoreHorizontal, Power, PowerOff, Trash2 } from "lucide-react";

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
  promoTypeLabels,
  usageLabel,
} from "./promoCodePresentation";

interface PromoCodeRowProps {
  code: AdminPromoCode;
  busy: boolean;
  onAction: (code: AdminPromoCode, action: PromoCodeAction) => void;
}

export function PromoCodeRow({ code, busy, onAction }: PromoCodeRowProps) {
  const status = promoStatus(code);

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
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">{code.name}</p>
      </div>
      <div className="text-xs">
        <p className="font-medium">{promoTypeLabels[code.type]}</p>
        <p className="capitalize text-muted-foreground">{code.plan_name}</p>
      </div>
      <div className="text-xs">
        <p className="font-medium">{usageLabel(code)}</p>
        <p className="text-muted-foreground">
          {code.duration_months} month{code.duration_months === 1 ? "" : "s"}
        </p>
      </div>
      <div className="text-xs">
        <p className="font-medium">Expires {formatPromoDate(code.expires_at)}</p>
        <p className="text-muted-foreground">
          Created {formatPromoDate(code.created_at)}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            aria-label={`Actions for ${code.code}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/promo-codes/${code.id}`}>View and edit</Link>
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
            {code.is_active ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => onAction(code, "delete")}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
