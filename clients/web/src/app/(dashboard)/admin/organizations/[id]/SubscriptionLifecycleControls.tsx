"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Snowflake, Play, RefreshCw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SubscriptionLifecycleControls({
  status,
  busy,
  onFreeze,
  onUnfreeze,
  onCancel,
  onRenew,
}: {
  status: string;
  busy: boolean;
  onFreeze: () => void;
  onUnfreeze: () => void;
  onCancel: () => void;
  onRenew: (months: number) => void;
}) {
  const t = useTranslations("admin");
  const [months, setMonths] = useState("1");

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">{t("subscription.lifecycle")}</h3>
      <div className="flex flex-wrap gap-2">
        {status === "frozen" ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={onUnfreeze}>
            <Play className="mr-2 h-4 w-4" />
            {t("subscription.unfreeze")}
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled={busy} onClick={onFreeze}>
            <Snowflake className="mr-2 h-4 w-4" />
            {t("subscription.freeze")}
          </Button>
        )}
        {status !== "canceled" && (
          <Button variant="destructive" size="sm" disabled={busy} onClick={onCancel}>
            <XCircle className="mr-2 h-4 w-4" />
            {t("common.cancel")}
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Input
            className="w-20"
            type="number"
            min={1}
            max={120}
            value={months}
            onChange={(event) => setMonths(event.target.value)}
            aria-label={t("subscription.renewalMonthsAria")}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={busy || Number(months) < 1 || Number(months) > 120}
            onClick={() => onRenew(Number(months))}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("subscription.renew")}
          </Button>
        </div>
      </div>
    </div>
  );
}
