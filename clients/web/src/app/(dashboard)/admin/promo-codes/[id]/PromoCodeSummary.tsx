import { CalendarClock, Clock, TicketPercent, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AdminPromoCode } from "@/lib/api/admin/promoTypes";
import {
  formatPromoDate,
  promoStatus,
  promoTypeLabels,
  usageLabel,
} from "../promoCodePresentation";

export function PromoCodeSummary({ code }: { code: AdminPromoCode }) {
  const status = promoStatus(code);
  const facts = [
    {
      label: "Offer",
      value: `${code.duration_months} month${code.duration_months === 1 ? "" : "s"} of ${code.plan_name}`,
      detail: promoTypeLabels[code.type],
      icon: TicketPercent,
    },
    {
      label: "Usage",
      value: usageLabel(code),
      detail: `${code.max_uses_per_org} per organization`,
      icon: Users,
    },
    {
      label: "Starts",
      value: formatPromoDate(code.starts_at),
      detail: `Created ${formatPromoDate(code.created_at)}`,
      icon: Clock,
    },
    {
      label: "Expires",
      value: formatPromoDate(code.expires_at),
      detail: `Updated ${formatPromoDate(code.updated_at)}`,
      icon: CalendarClock,
    },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {facts.map(({ label, value, detail, icon: Icon }) => (
        <div key={label} className="border-l-2 border-border pl-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className="h-4 w-4" />
            {label}
            {label === "Offer" && <Badge variant={status.variant}>{status.label}</Badge>}
          </div>
          <p className="mt-2 text-sm font-semibold capitalize">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
      ))}
    </section>
  );
}
