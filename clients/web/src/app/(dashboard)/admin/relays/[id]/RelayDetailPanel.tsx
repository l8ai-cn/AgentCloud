import { Activity, MapPin, Radio } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import type { AdminRelay } from "@/lib/api/admin/relays";

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1 border-b border-border py-3 last:border-b-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "break-all font-mono text-sm" : "text-sm"}>{value}</dd>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface-raised">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <dl className="px-4">{children}</dl>
    </section>
  );
}

export function RelayDetailPanel({ relay }: { relay: AdminRelay }) {
  const load = relay.capacity > 0
    ? Math.min(100, Math.round((relay.connections / relay.capacity) * 100))
    : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Connection" icon={<Radio className="h-4 w-4 text-muted-foreground" />}>
        <DetailRow
          label="Status"
          value={
            <Badge variant={relay.healthy ? "success" : "destructive"}>
              {relay.healthy ? "Healthy" : "Unhealthy"}
            </Badge>
          }
        />
        <DetailRow label="Relay ID" value={relay.id} mono />
        <DetailRow label="URL" value={relay.url} mono />
        <DetailRow label="Region" value={relay.region || "Not reported"} />
        <DetailRow
          label="Last heartbeat"
          value={relay.last_heartbeat
            ? new Date(relay.last_heartbeat).toLocaleString()
            : "Never"}
        />
      </Section>

      <Section title="Capacity and health" icon={<Activity className="h-4 w-4 text-muted-foreground" />}>
        <DetailRow
          label="Connections"
          value={
            <div className="space-y-1.5">
              <span>{relay.connections} / {relay.capacity} ({load}%)</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full bg-primary" style={{ width: `${load}%` }} />
              </div>
            </div>
          }
        />
        <DetailRow label="Average latency" value={`${relay.avg_latency_ms} ms`} />
        <DetailRow label="CPU usage" value={`${relay.cpu_usage.toFixed(1)}%`} />
        <DetailRow label="Memory usage" value={`${relay.memory_usage.toFixed(1)}%`} />
      </Section>

      <div className="lg:col-span-2">
        <Section title="Location" icon={<MapPin className="h-4 w-4 text-muted-foreground" />}>
          <DetailRow label="Latitude" value={relay.latitude.toFixed(6)} mono />
          <DetailRow label="Longitude" value={relay.longitude.toFixed(6)} mono />
        </Section>
      </div>
    </div>
  );
}
