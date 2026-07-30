"use client";

import { useState } from "react";

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
  const [seats, setSeats] = useState(String(subscription.seat_count));
  const busy = mutation !== null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3 border-l-2 border-primary/40 pl-4">
        <h3 className="text-sm font-semibold">Plan and seats</h3>
        <Select value={subscription.plan?.name ?? ""} onValueChange={onPlan} disabled={busy}>
          <SelectTrigger aria-label="Subscription plan">
            <SelectValue placeholder="Select plan" />
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
            aria-label="Seat count"
          />
          <Button
            variant="outline"
            disabled={busy || Number(seats) < (subscription.seat_usage?.used_seats ?? 1)}
            onClick={() => onSeats(Number(seats))}
          >
            Set seats
          </Button>
        </div>
        {subscription.seat_usage && (
          <p className="text-xs text-muted-foreground">
            {subscription.seat_usage.used_seats} used, {subscription.seat_usage.available_seats} available
          </p>
        )}
      </div>

      <div className="space-y-3 border-l-2 border-border pl-4">
        <h3 className="text-sm font-semibold">Billing</h3>
        <Select value={subscription.billing_cycle} onValueChange={onCycle} disabled={busy}>
          <SelectTrigger aria-label="Billing cycle"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <div>
            <p className="text-sm font-medium">Auto-renew</p>
            <p className="text-xs text-muted-foreground">Renew at the end of the current period.</p>
          </div>
          <Switch
            checked={subscription.auto_renew}
            disabled={busy}
            onCheckedChange={onAutoRenew}
            aria-label="Auto-renew"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {new Date(subscription.current_period_start).toLocaleDateString()} to{" "}
          {new Date(subscription.current_period_end).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
