"use client";

import { Radio, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminRelay } from "@/lib/api/admin/relays";

export function RelayRow({
  relay,
  busy,
  onUnregister,
}: {
  relay: AdminRelay;
  busy: boolean;
  onUnregister: () => void;
}) {
  const load = relay.capacity > 0
    ? Math.min(100, Math.round((relay.connections / relay.capacity) * 100))
    : 0;

  return (
    <div className="grid gap-3 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,2fr)_minmax(11rem,1fr)_auto] md:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-muted">
          <Radio className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{relay.id}</p>
            <Badge variant={relay.healthy ? "success" : "destructive"}>
              {relay.healthy ? "Healthy" : "Unhealthy"}
            </Badge>
            {relay.region && <Badge variant="outline">{relay.region}</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">{relay.url}</p>
        </div>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full bg-primary" style={{ width: `${load}%` }} />
        </div>
        <p>{relay.connections}/{relay.capacity} connections · {relay.avg_latency_ms} ms</p>
        <p>CPU {relay.cpu_usage.toFixed(1)}% · Memory {relay.memory_usage.toFixed(1)}%</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        disabled={busy}
        aria-label={`Unregister ${relay.id}`}
        title="Force unregister relay"
        className="text-destructive hover:text-destructive"
        onClick={onUnregister}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
