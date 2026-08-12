"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  fetchMarketplaceListings,
  fetchMarketplaceSummary,
  type MarketplaceListingSummary,
} from "@/lib/marketplace/catalog-api";
import {
  filterCatalogListings,
  marketplaceSpaceHref,
} from "@/lib/marketplace/catalog-listing-filter";
import { uniqueListingSpaces } from "@/lib/marketplace/presentation";
import { MarketplaceCatalogFilters } from "./MarketplaceCatalogFilters";
import { MarketplaceCatalogHero } from "./MarketplaceCatalogHero";
import {
  MarketplaceCatalogEmpty,
  MarketplaceCatalogLoading,
} from "./MarketplaceCatalogStatus";
import { MarketplaceListingCard } from "./MarketplaceListingCard";

export function MarketplaceCatalogPage({ orgSlug }: { orgSlug: string }) {
  return (
    <Suspense fallback={<MarketplaceCatalogLoading />}>
      <MarketplaceCatalogBody orgSlug={orgSlug} />
    </Suspense>
  );
}

function MarketplaceCatalogBody({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations("marketplace");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const space = searchParams.get("space") ?? "";
  const [listings, setListings] = useState<MarketplaceListingSummary[]>([]);
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchMarketplaceSummary(),
      fetchMarketplaceListings({ type: "application" }),
    ])
      .then(([market, items]) => {
        setName(market.name);
        setSummary(market.summary);
        setListings(items);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : t("loadError"));
      })
      .finally(() => setLoading(false));
  }, [t]);

  const spaces = uniqueListingSpaces(listings.flatMap((item) => item.spaces));
  const visible = filterCatalogListings(listings, query, space);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-5 lg:p-8">
      <MarketplaceCatalogHero
        name={name || t("fallbackTitle")}
        summary={summary || t("fallbackSummary")}
      />
      <MarketplaceCatalogFilters
        query={query}
        onQueryChange={setQuery}
        spaces={spaces}
        space={space}
        onSpaceChange={(slug) =>
          router.replace(marketplaceSpaceHref(pathname, searchParams, slug), { scroll: false })
        }
      />
      {loading ? <MarketplaceCatalogLoading /> : null}
      {error ? <p role="alert" className="rounded-lg bg-danger-bg p-4 text-sm text-danger">{error}</p> : null}
      {!loading && !error && listings.length === 0 ? <MarketplaceCatalogEmpty kind="market" /> : null}
      {!loading && !error && listings.length > 0 && visible.length === 0 ? (
        <MarketplaceCatalogEmpty kind="filter" />
      ) : null}
      {!loading && visible.length ? (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">{t("available")}</h2>
            <span className="text-sm text-muted-foreground">{t("resultCount", { count: visible.length })}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((listing) => (
              <MarketplaceListingCard key={listing.listing_id} listing={listing} orgSlug={orgSlug} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
