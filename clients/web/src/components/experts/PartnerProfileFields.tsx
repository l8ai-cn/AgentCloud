import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function PartnerProfileSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="surface-card overflow-hidden rounded-md border border-border">
      <header className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">{title}</h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PartnerProfileField({
  icon: Icon,
  label,
  value,
}: {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border/40 py-2.5 last:border-0">
      <dt className="flex w-36 shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </dt>
      <dd className="min-w-0 flex-1 break-words text-sm">{value}</dd>
    </div>
  );
}

export function PartnerProfileChips({
  items,
  empty,
  variant = "secondary",
}: {
  items: string[];
  empty: string;
  variant?: "secondary" | "info" | "success";
}) {
  if (!items.length) {
    return <span className="text-sm text-muted-foreground">{empty}</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge key={item} variant={variant} className="font-normal">
          {item}
        </Badge>
      ))}
    </div>
  );
}
