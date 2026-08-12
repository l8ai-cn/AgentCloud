"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Check, ExternalLink, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  fetchMarketplaceListingDetail,
  type MarketplaceListingDetail,
} from "@/lib/marketplace/catalog-api";
import { formatMarketplaceCredits } from "@/lib/marketplace/presentation";
import { MarketplaceInstallAction } from "./MarketplaceInstallAction";

export function MarketplaceDetailPage({
  orgSlug,
  listingSlug,
}: {
  orgSlug: string;
  listingSlug: string;
}) {
  const t = useTranslations("marketplace");
  const router = useRouter();
  const [listing, setListing] = useState<MarketplaceListingDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMarketplaceListingDetail(listingSlug)
      .then(setListing)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : t("loadError")));
  }, [listingSlug, t]);

  if (error) return <State message={error} />;
  if (!listing) return <State message={t("loadingDetail")} />;

  const credits = formatMarketplaceCredits(listing.quota);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-5 lg:p-8">
      <Link href={`/${orgSlug}/marketplace`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {t("backToMarket")}
      </Link>
      <section className="rounded-2xl border border-border bg-surface-raised p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <div>
            <div className="flex flex-wrap gap-2">
              {listing.spaces.map((space) => (
                <Badge key={space.slug} variant="secondary">{space.name}</Badge>
              ))}
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">{listing.display_name}</h1>
            <p className="mt-3 text-base leading-7 text-muted-foreground">{listing.tagline}</p>
            <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              {listing.publisher.display_name}
              {listing.publisher.verified ? (
                <span className="inline-flex items-center gap-1 text-success">
                  <BadgeCheck className="h-4 w-4" />
                  {t("verifiedPublisher")}
                </span>
              ) : null}
            </p>
          </div>
          <aside className="rounded-xl border border-border bg-surface-muted/60 p-5">
            <p className="text-xs font-medium text-muted-foreground">{t("currentVersion")}</p>
            <p className="mt-1 text-xl font-semibold text-foreground">v{listing.version}</p>
            <p className="mt-5 text-xs font-medium text-muted-foreground">{t("runtimeType")}</p>
            <p className="mt-1 text-sm font-medium text-foreground">{listing.agent_slug}</p>
            <p className="mt-5 text-xs font-medium text-muted-foreground">{t("estimatedCredits")}</p>
            <p className="mt-1 text-sm text-foreground">
              {credits ? t("credits", { amount: credits }) : t("creditsPending")}
            </p>
            <div className="mt-6">
              <MarketplaceInstallAction
                applicationSlug={listing.slug}
                agentSlug={listing.agent_slug}
                orgSlug={orgSlug}
                onInstalled={(targetOrgSlug, expertSlug, alreadyInstalled) => {
                  toast.success(alreadyInstalled ? t("alreadyInstalled") : t("installed"));
                  router.push(`/${targetOrgSlug}/experts/${expertSlug}`);
                }}
                onNeedsOrganization={() => router.push("/onboarding/create-org")}
                onConfigureResources={(targetOrgSlug) =>
                  router.push(`/${targetOrgSlug}/settings?tab=ai-resources`)
                }
              />
            </div>
          </aside>
        </div>
      </section>
      <MarketplaceListingSections listing={listing} />
    </div>
  );
}

function MarketplaceListingSections({ listing }: { listing: MarketplaceListingDetail }) {
  const t = useTranslations("marketplace");
  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <DetailSection title={t("description")}><p>{listing.description}</p></DetailSection>
        <DetailList title={t("outcomes")} items={listing.outcomes} />
        <DetailList title={t("useCases")} items={listing.use_cases} />
        <DetailList title={t("audience")} items={listing.target_audience} />
      </div>
      <div className="space-y-6">
        <DetailList title={t("requirements")} items={listing.requirements} />
        <DetailList title={t("permissions")} items={listing.permissions} icon={ShieldCheck} />
        <DetailSection title={t("releaseNotes")}>
          <p>{listing.release_notes || t("noReleaseNotes")}</p>
        </DetailSection>
        {(listing.documentation_url || listing.support_url) ? (
          <div className="space-y-2 text-sm">
            {listing.documentation_url ? (
              <a className="flex items-center gap-1 text-primary hover:text-primary/80" href={listing.documentation_url}>
                {t("viewDocs")} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
            {listing.support_url ? (
              <a className="flex items-center gap-1 text-primary hover:text-primary/80" href={listing.support_url}>
                {t("getSupport")} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function State({ message }: { message: string }) {
  return <div className="mx-auto max-w-6xl p-8 text-sm text-muted-foreground">{message}</div>;
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface-raised p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-3 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

function DetailList({ title, items, icon: Icon = Check }: { title: string; items: string[]; icon?: typeof Check }) {
  if (!items.length) return null;
  return (
    <DetailSection title={title}>
      <ul className="space-y-2">
        {items.map((item) => (
          <li className="flex gap-2" key={item}>
            <Icon className="mt-1 h-4 w-4 shrink-0 text-primary" />
            {item}
          </li>
        ))}
      </ul>
    </DetailSection>
  );
}
