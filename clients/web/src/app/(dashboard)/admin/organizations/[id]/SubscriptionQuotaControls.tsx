"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminSubscription } from "@/lib/api/admin/subscriptionTypes";

const resources = ["users", "runners", "concurrent_pods", "repositories", "pod_minutes"];

export function SubscriptionQuotaControls({
  subscription,
  busy,
  onSetQuota,
}: {
  subscription: AdminSubscription;
  busy: boolean;
  onSetQuota: (resource: string, limit: number) => void;
}) {
  const t = useTranslations("admin");
  const [resource, setResource] = useState(resources[0]);
  const [limit, setLimit] = useState("");

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("subscription.customQuotas")}</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(subscription.custom_quotas ?? {}).map(([key, value]) => (
            <Badge key={key} variant="outline">
              {t("subscription.quotaBadge", {
                resource: key,
                value: value === -1 ? t("subscription.unlimited") : String(value),
              })}
            </Badge>
          ))}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(10rem,1fr)_8rem_auto]">
        <Select value={resource} onValueChange={setResource} disabled={busy}>
          <SelectTrigger aria-label={t("subscription.quotaResourceAria")}><SelectValue /></SelectTrigger>
          <SelectContent>
            {resources.map((item) => (
              <SelectItem key={item} value={item}>{item}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          value={limit}
          onChange={(event) => setLimit(event.target.value)}
          placeholder={t("subscription.quotaLimitPlaceholder")}
          aria-label={t("subscription.quotaLimitAria")}
        />
        <Button
          variant="outline"
          disabled={busy || limit === "" || Number.isNaN(Number(limit))}
          onClick={() => onSetQuota(resource, Number(limit))}
        >
          {t("subscription.setOverride")}
        </Button>
      </div>
    </div>
  );
}
