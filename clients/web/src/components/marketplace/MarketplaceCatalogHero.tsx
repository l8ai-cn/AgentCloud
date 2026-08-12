"use client";

import { useTranslations } from "next-intl";

export function MarketplaceCatalogHero({
  name,
  summary,
}: {
  name: string;
  summary: string;
}) {
  const t = useTranslations("marketplace");
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-[var(--shadow-soft)]">
      <div className="grid gap-6 bg-[linear-gradient(118deg,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_55%)] p-6 sm:p-8 lg:grid-cols-[1fr_270px]">
        <div>
          <p className="text-sm font-medium text-primary">{t("eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{summary}</p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <p className="text-sm font-medium text-foreground">{t("previewTitle")}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("previewBody")}</p>
        </div>
      </div>
    </section>
  );
}
