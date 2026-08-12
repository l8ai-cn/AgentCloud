"use client";

import { useTranslations } from "next-intl";

export function MarketplaceFooter() {
  const t = useTranslations("marketplace");
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <span>{t("footer.brand")}</span>
        <span>{t("footer.composition")}</span>
      </div>
    </footer>
  );
}
