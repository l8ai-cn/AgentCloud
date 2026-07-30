"use client";

import { useState } from "react";
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
  const [months, setMonths] = useState("1");

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">Lifecycle</h3>
      <div className="flex flex-wrap gap-2">
        {status === "frozen" ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={onUnfreeze}>
            <Play className="mr-2 h-4 w-4" />
            Unfreeze
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled={busy} onClick={onFreeze}>
            <Snowflake className="mr-2 h-4 w-4" />
            Freeze
          </Button>
        )}
        {status !== "canceled" && (
          <Button variant="destructive" size="sm" disabled={busy} onClick={onCancel}>
            <XCircle className="mr-2 h-4 w-4" />
            Cancel
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
            aria-label="Renewal months"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={busy || Number(months) < 1 || Number(months) > 120}
            onClick={() => onRenew(Number(months))}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Renew
          </Button>
        </div>
      </div>
    </div>
  );
}
