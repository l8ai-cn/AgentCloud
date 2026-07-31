import { CalendarClock, Clock, TicketPercent, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { AdminPromoCode } from "@/lib/api/admin/promoTypes";
import {
  formatPromoDate,
  promoStatus,
  promoTypeLabelKeys,
  promoUsageMessage,
} from "../promoCodePresentation";

export function PromoCodeSummary({ code }: { code: AdminPromoCode }) {
  const t = useTranslations("admin");
  const status = promoStatus(code);
  const usage = promoUsageMessage(code);
  const promoDate = (value: string | null) =>
    formatPromoDate(value) ?? t("common.never");
  const facts = [
    {
      id: "offer",
      label: t("promoCodes.summary.offer"),
      value: t("promoCodes.summary.offerValue", {
        count: code.duration_months,
        plan: code.plan_name,
      }),
      detail: t(promoTypeLabelKeys[code.type]),
      icon: TicketPercent,
    },
    {
      id: "usage",
      label: t("promoCodes.summary.usage"),
      value: t(usage.key, usage.values),
      detail: t("promoCodes.summary.usagePerOrg", {
        count: code.max_uses_per_org,
      }),
      icon: Users,
    },
    {
      id: "starts",
      label: t("promoCodes.summary.starts"),
      value: promoDate(code.starts_at),
      detail: t("promoCodes.createdAt", { date: promoDate(code.created_at) }),
      icon: Clock,
    },
    {
      id: "expires",
      label: t("promoCodes.summary.expires"),
      value: promoDate(code.expires_at),
      detail: t("promoCodes.updatedAt", { date: promoDate(code.updated_at) }),
      icon: CalendarClock,
    },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {facts.map(({ id, label, value, detail, icon: Icon }) => (
        <div key={id} className="border-l-2 border-border pl-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className="h-4 w-4" />
            {label}
            {id === "offer" && <Badge variant={status.variant}>{t(status.labelKey)}</Badge>}
          </div>
          <p className="mt-2 text-sm font-semibold capitalize">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
      ))}
    </section>
  );
}
