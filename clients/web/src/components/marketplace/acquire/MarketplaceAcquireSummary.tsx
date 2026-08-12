import { BadgeCheck, Building2, Gauge, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type {
  InstallationPlan,
  MarketplaceListingDetail,
} from "@/lib/marketplace/acquire-api";
import { formatMarketplaceCredits } from "@/lib/marketplace/presentation";

interface Props {
  listing: MarketplaceListingDetail;
  organizationName: string;
  plan: InstallationPlan;
}

export function MarketplaceAcquireSummary({
  listing,
  organizationName,
  plan,
}: Props) {
  const t = useTranslations("marketplace");
  const locale = useLocale();
  const amount = formatMarketplaceCredits({
    mode: "per_install",
    estimated_credits_micro: plan.plan.estimated_credits_micro,
  });
  const credits = amount ? t("credits", { amount }) : t("acquire.creditsActual");

  return (
    <section className="space-y-5" aria-labelledby="confirm-title">
      <div>
        <p className="text-sm font-medium text-primary">{t("acquire.confirmEyebrow")}</p>
        <h2 id="confirm-title" className="mt-1 text-2xl font-semibold text-foreground">
          {t("acquire.confirmTitle")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("acquire.planValidUntil", {
            time: new Date(plan.plan.expires_at).toLocaleTimeString(locale),
          })}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryItem icon={Building2} label={t("acquire.targetOrg")} value={organizationName} />
        <SummaryItem icon={Gauge} label={t("acquire.estimatedEnableCredits")} value={credits} />
        <SummaryItem icon={BadgeCheck} label={t("acquire.applicationVersion")} value={`v${listing.version}`} />
        <SummaryItem
          icon={ShieldCheck}
          label={t("acquire.permissionCount")}
          value={t("acquire.permissionCountValue", { count: plan.plan.required_permissions.length })}
        />
      </div>
      <div className="rounded-lg border border-warning/30 bg-warning-bg p-4">
        <p className="text-sm font-medium text-foreground">{t("acquire.warningTitle")}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t("acquire.warningBody", { name: organizationName })}
        </p>
      </div>
    </section>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
