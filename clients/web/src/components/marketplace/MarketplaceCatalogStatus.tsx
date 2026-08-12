"use client";

import { useTranslations } from "next-intl";

export function MarketplaceCatalogLoading() {
  const t = useTranslations("marketplace");
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={t("loadingAria")}>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-64 animate-pulse rounded-xl border border-border bg-surface-muted" />
      ))}
    </div>
  );
}

export function MarketplaceCatalogEmpty({
  kind,
}: {
  kind: "market" | "filter";
}) {
  const t = useTranslations("marketplace");
  return (
    <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      {kind === "market" ? t("emptyMarket") : t("emptyFilter")}
    </p>
  );
}
