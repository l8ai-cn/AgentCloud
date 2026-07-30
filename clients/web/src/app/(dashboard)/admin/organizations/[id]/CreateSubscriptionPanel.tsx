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
import type { AdminSubscriptionPlan } from "@/lib/api/admin/subscriptionTypes";

export function CreateSubscriptionPanel({
  plans,
  busy,
  onCreate,
}: {
  plans: AdminSubscriptionPlan[];
  busy: boolean;
  onCreate: (plan: string, months: number) => void;
}) {
  const [plan, setPlan] = useState("");
  const [months, setMonths] = useState("1");
  const selectedPlan = plan || plans[0]?.name || "";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This organization has no subscription record.
      </p>
      <div className="grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_8rem_auto]">
        <Select value={selectedPlan} onValueChange={setPlan} disabled={busy}>
          <SelectTrigger aria-label="New subscription plan">
            <SelectValue placeholder="Select plan" />
          </SelectTrigger>
          <SelectContent>
            {plans.map((item) => (
              <SelectItem key={item.name} value={item.name}>
                {item.display_name || item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={1}
          max={120}
          value={months}
          onChange={(event) => setMonths(event.target.value)}
          aria-label="Subscription months"
        />
        <Button
          disabled={busy || !selectedPlan || Number(months) < 1 || Number(months) > 120}
          onClick={() => onCreate(selectedPlan, Number(months))}
        >
          Create subscription
        </Button>
      </div>
    </div>
  );
}
