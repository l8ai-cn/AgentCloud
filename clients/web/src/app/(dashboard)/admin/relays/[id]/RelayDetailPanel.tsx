import { Activity, MapPin, Radio } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("admin");
  const load = relay.capacity > 0
    ? Math.min(100, Math.round((relay.connections / relay.capacity) * 100))
    : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section
        title={t("relays.detail.connection")}
        icon={<Radio className="h-4 w-4 text-muted-foreground" />}
      >
        <DetailRow
          label={t("relays.detail.status")}
          value={
            <Badge variant={relay.healthy ? "success" : "destructive"}>
              {relay.healthy ? t("relays.healthy") : t("relays.unhealthy")}
            </Badge>
          }
        />
        <DetailRow label={t("relays.detail.relayId")} value={relay.id} mono />
        <DetailRow label={t("relays.detail.url")} value={relay.url} mono />
        <DetailRow
          label={t("relays.detail.region")}
          value={relay.region || t("relays.detail.notReported")}
        />
        <DetailRow
          label={t("relays.detail.lastHeartbeat")}
          value={relay.last_heartbeat
            ? new Date(relay.last_heartbeat).toLocaleString()
            : t("common.never")}
        />
      </Section>

      <Section
        title={t("relays.detail.capacityAndHealth")}
        icon={<Activity className="h-4 w-4 text-muted-foreground" />}
      >
        <DetailRow
          label={t("relays.detail.connections")}
          value={
            <div className="space-y-1.5">
              <span>
                {t("relays.detail.connectionsUsage", {
                  connections: relay.connections,
                  capacity: relay.capacity,
                  load,
                })}
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full bg-primary" style={{ width: `${load}%` }} />
              </div>
            </div>
          }
        />
        <DetailRow
          label={t("relays.detail.averageLatency")}
          value={t("relays.detail.milliseconds", { value: relay.avg_latency_ms })}
        />
        <DetailRow
          label={t("relays.detail.cpuUsage")}
          value={t("relays.detail.percent", { value: relay.cpu_usage.toFixed(1) })}
        />
        <DetailRow
          label={t("relays.detail.memoryUsage")}
          value={t("relays.detail.percent", { value: relay.memory_usage.toFixed(1) })}
        />
      </Section>

      <div className="lg:col-span-2">
        <Section
          title={t("relays.detail.location")}
          icon={<MapPin className="h-4 w-4 text-muted-foreground" />}
        >
          <DetailRow label={t("relays.detail.latitude")} value={relay.latitude.toFixed(6)} mono />
          <DetailRow label={t("relays.detail.longitude")} value={relay.longitude.toFixed(6)} mono />
        </Section>
      </div>
    </div>
  );
}
