import Link from "next/link";
import {
  BadgeCheck,
  CheckCircle2,
  Clapperboard,
  Film,
  GraduationCap,
  Palette,
  Scissors,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import type {
  MarketplaceListingSummary,
  MarketplaceResourceType,
} from "@/lib/marketplace/catalog-api";
import {
  formatMarketplaceCredits,
  marketplaceTypeLabels,
} from "@/lib/marketplace/presentation";

const icons: Record<MarketplaceListingSummary["icon"], LucideIcon> = {
  rocket: Sparkles,
  network: Sparkles,
  "git-compare": Sparkles,
  clapperboard: Clapperboard,
  scissors: Scissors,
  film: Film,
  palette: Palette,
  "graduation-cap": GraduationCap,
};

const iconStyles: Record<MarketplaceResourceType, string> = {
  application: "bg-primary/10 text-primary",
  skill: "bg-info-bg text-info",
  mcp_connector: "bg-warning-bg text-warning",
  resource: "bg-secondary text-foreground",
};

export function MarketplaceListingCard({
  listing,
  orgSlug,
}: {
  listing: MarketplaceListingSummary;
  orgSlug: string;
}) {
  const Icon = icons[listing.icon];
  const credits = formatMarketplaceCredits(listing.quota);

  return (
    <article className="flex min-h-64 flex-col rounded-xl border border-border bg-surface-raised p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <span className={`rounded-lg p-2.5 ${iconStyles[listing.resource_type]}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {marketplaceTypeLabels[listing.resource_type]}
        </span>
      </div>
      <div className="flex-1 pt-6">
        <h2 className="text-lg font-semibold text-foreground">{listing.display_name}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{listing.tagline}</p>
        {listing.outcomes.length ? (
          <div className="mt-4 space-y-2">
            {listing.outcomes.slice(0, 2).map((outcome) => (
              <p key={outcome} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{outcome}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <div className="space-y-3 border-t border-border pt-4 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <span>{listing.publisher.display_name}</span>
          {listing.publisher.verified ? (
            <span className="inline-flex items-center gap-1 text-success">
              <BadgeCheck className="h-3.5 w-3.5" />
              已认证
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>{listing.spaces[0]?.name ?? "未分配专区"} · {listing.agent_slug}</span>
          <span>{listing.skill_slugs.length} 项 Skills</span>
        </div>
        {credits ? <p>{credits}</p> : null}
        <Link
          href={`/${orgSlug}/marketplace/${listing.slug}`}
          className="inline-flex pt-1 text-sm font-medium text-primary hover:text-primary/80"
        >
          查看详情
        </Link>
      </div>
    </article>
  );
}
