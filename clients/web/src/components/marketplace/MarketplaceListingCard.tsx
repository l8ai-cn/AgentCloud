import Link from "next/link";
import { AppWindow, BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import type { MarketplaceListingSummary } from "@/lib/marketplace/catalog-api";
import { formatMarketplaceCredits } from "@/lib/marketplace/presentation";

export function MarketplaceListingCard({
  listing,
  orgSlug,
}: {
  listing: MarketplaceListingSummary;
  orgSlug: string;
}) {
  const t = useTranslations("marketplace");
  const credits = formatMarketplaceCredits(listing.quota);
  const spaceName = listing.spaces[0]?.name ?? t("unassignedSpace");

  return (
    <article className="flex min-h-64 flex-col rounded-xl border border-border bg-surface-raised p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-lg bg-primary/10 p-2.5 text-primary">
          <AppWindow className="h-5 w-5" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">{spaceName}</span>
      </div>
      <div className="flex-1 pt-6">
        <h2 className="text-lg font-semibold text-foreground">{listing.display_name}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{listing.tagline}</p>
      </div>
      <div className="space-y-3 border-t border-border pt-4 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <span>{listing.publisher.display_name}</span>
          {listing.publisher.verified ? (
            <span className="inline-flex items-center gap-1 text-success">
              <BadgeCheck className="h-3.5 w-3.5" />
              {t("verified")}
            </span>
          ) : null}
        </div>
        {credits ? <p>{t("credits", { amount: credits })}</p> : null}
        <Link
          href={`/${orgSlug}/marketplace/${listing.slug}`}
          className="inline-flex pt-1 text-sm font-medium text-primary hover:text-primary/80"
        >
          {t("viewDetails")}
        </Link>
      </div>
    </article>
  );
}
