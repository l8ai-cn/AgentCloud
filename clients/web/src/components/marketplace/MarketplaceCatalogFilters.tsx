"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import type { MarketplaceSpace } from "@/lib/marketplace/catalog-api";

const filterClass =
  "shrink-0 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground";
const selectedFilterClass =
  "shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary";

export function MarketplaceCatalogFilters({
  query,
  onQueryChange,
  spaces,
  space,
  onSpaceChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  spaces: MarketplaceSpace[];
  space: string;
  onSpaceChange: (slug: string) => void;
}) {
  const t = useTranslations("marketplace");
  return (
    <section className="rounded-xl border border-border bg-surface-raised p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchAria")}
          className="border-0 bg-transparent shadow-none ring-0"
        />
      </div>
      {spaces.length ? (
        <div className="mt-4 flex items-center gap-2 overflow-x-auto border-t border-border pb-1 pt-4">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
          <button
            type="button"
            onClick={() => onSpaceChange("")}
            className={space ? filterClass : selectedFilterClass}
          >
            {t("allSpaces")}
          </button>
          {spaces.map((item) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => onSpaceChange(item.slug)}
              className={space === item.slug ? selectedFilterClass : filterClass}
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
