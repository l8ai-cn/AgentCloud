import {
  CheckCircle2,
  Clapperboard,
  Film,
  GraduationCap,
  GitCompareArrows,
  Network,
  Palette,
  Rocket,
  Scissors,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { PublicMarketApplication } from "@/lib/public-market-api";
import { MarketplaceInstallButton } from "./MarketplaceInstallButton";

const icons: Record<PublicMarketApplication["icon"], LucideIcon> = {
  rocket: Rocket,
  network: Network,
  "git-compare": GitCompareArrows,
  clapperboard: Clapperboard,
  scissors: Scissors,
  film: Film,
  palette: Palette,
  "graduation-cap": GraduationCap,
};

export function MarketplaceApplicationCard({
  application,
}: {
  application: PublicMarketApplication;
}) {
  const t = useTranslations("marketplace");
  const Icon = icons[application.icon];

  return (
    <article className="flex min-h-[420px] flex-col border border-white/10 bg-[var(--expert-panel)] p-6 transition hover:-translate-y-1 hover:border-[var(--expert-action)]/50">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-white">{application.name}</h2>
              {application.featured ? (
                <Badge className="bg-[var(--expert-action)] text-[var(--expert-ink)]">{t("public.featured")}</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {application.category} · {application.agent_slug}
            </p>
          </div>
        </div>
        <Badge variant="outline">v{application.version}</Badge>
      </div>
      <p className="mt-5 text-sm font-medium leading-6 text-white">{application.summary}</p>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--expert-muted)]">
        {application.description}
      </p>
      <div className="mt-5 space-y-2">
        {application.outcomes.map((outcome) => (
          <div key={outcome} className="flex items-start gap-2 text-sm text-[var(--expert-text)]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--expert-status)]" />
            <span>{outcome}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 border-t border-border pt-4">
        <p className="text-xs font-medium text-[var(--expert-muted)]">
          {t("public.builtinSkills", { count: application.skill_slugs.length })}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {application.skill_slugs.map((skill) => (
            <Badge key={skill} variant="secondary" className="font-mono font-normal">
              {skill}
            </Badge>
          ))}
        </div>
      </div>
      <div className="mt-auto pt-6">
        <MarketplaceInstallButton applicationSlug={application.slug} agentSlug={application.agent_slug} />
        <span className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--expert-muted)]">
          {t("public.viewDuties")} <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </article>
  );
}
