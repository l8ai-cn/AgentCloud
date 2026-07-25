import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function PartnerMetricCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="surface-card rounded-md p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export function PartnerStatisticsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-background">
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PartnerRateRow({
  label,
  value,
  count,
}: {
  label: string;
  value: number;
  count: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{count}</span>
      </div>
      <Progress value={value} aria-label={label} />
    </div>
  );
}

export function PartnerCapabilityMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md bg-muted/35 p-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
