"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type {
  AdminSubscription,
  AdminSubscriptionPlan,
} from "@/lib/api/admin/subscriptionTypes";

export function SubscriptionCoreControls({
  subscription,
  plans,
  mutation,
  onPlan,
  onSeats,
  onCycle,
  onAutoRenew,
}: {
  subscription: AdminSubscription;
  plans: AdminSubscriptionPlan[];
  mutation: string | null;
  onPlan: (plan: string) => void;
  onSeats: (seats: number) => void;
  onCycle: (cycle: string) => void;
  onAutoRenew: (enabled: boolean) => void;
}) {
  const t = useTranslations("admin");
  const [seats, setSeats] = useState(String(subscription.seat_count));
  const busy = mutation !== null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3 border-l-2 border-primary/40 pl-4">
        <h3 className="text-sm font-semibold">{t("subscription.planAndSeats")}</h3>
        <Select value={subscription.plan?.name ?? ""} onValueChange={onPlan} disabled={busy}>
          <SelectTrigger aria-label={t("subscription.planAria")}>
            <SelectValue placeholder={t("subscription.selectPlan")} />
          </SelectTrigger>
          <SelectContent>
            {plans.map((plan) => (
              <SelectItem key={plan.name} value={plan.name}>
                {plan.display_name || plan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input
            type="number"
            min={subscription.seat_usage?.used_seats ?? 1}
            value={seats}
            onChange={(event) => setSeats(event.target.value)}
            aria-label={t("subscription.seatCountAria")}
          />
          <Button
            variant="outline"
            disabled={busy || Number(seats) < (subscription.seat_usage?.used_seats ?? 1)}
            onClick={() => onSeats(Number(seats))}
          >
            {t("subscription.setSeats")}
          </Button>
        </div>
        {subscription.seat_usage && (
          <p className="text-xs text-muted-foreground">
            {t("subscription.seatUsage", {
              used: subscription.seat_usage.used_seats,
              available: subscription.seat_usage.available_seats,
            })}
          </p>
        )}
      </div>

      <div className="space-y-3 border-l-2 border-border pl-4">
        <h3 className="text-sm font-semibold">{t("subscription.billing")}</h3>
        <Select value={subscription.billing_cycle} onValueChange={onCycle} disabled={busy}>
          <SelectTrigger aria-label={t("subscription.billingCycleAria")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">{t("subscription.cycleMonthly")}</SelectItem>
            <SelectItem value="yearly">{t("subscription.cycleYearly")}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <div>
            <p className="text-sm font-medium">{t("subscription.autoRenew")}</p>
            <p className="text-xs text-muted-foreground">{t("subscription.autoRenewHint")}</p>
          </div>
          <Switch
            checked={subscription.auto_renew}
            disabled={busy}
            onCheckedChange={onAutoRenew}
            aria-label={t("subscription.autoRenew")}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {t("subscription.periodRange", {
            start: new Date(subscription.current_period_start).toLocaleDateString(),
            end: new Date(subscription.current_period_end).toLocaleDateString(),
          })}
        </p>
      </div>
    </div>
  );
}
