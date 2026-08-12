"use client";

import { useRouter } from "next/navigation";
import { BookOpen, Store } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { useCurrentOrg } from "@/stores/auth";

export function MarketplaceSidebarContent({ className }: { className?: string }) {
  const router = useRouter();
  const currentOrg = useCurrentOrg();
  const t = useTranslations();
  const orgSlug = currentOrg?.slug ?? "";

  const goBrowse = () => {
    if (orgSlug) router.push(`/${orgSlug}/marketplace`);
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="border-b border-border p-3">
        <h2 className="text-sm font-semibold">{t("ide.activities.marketplace")}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {t("ide.sidebar.marketplace.description")}
        </p>
      </div>
      <div className="flex-1 p-2">
        <button
          type="button"
          onClick={goBrowse}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Store className="h-4 w-4 shrink-0" />
          <span className="truncate">{t("ide.sidebar.marketplace.browse")}</span>
        </button>
      </div>
      <div className="bg-surface-muted/30 px-3 py-3 text-xs leading-5 text-muted-foreground">
        <BookOpen className="mr-1.5 inline h-3.5 w-3.5" />
        {t("ide.sidebar.marketplace.hint")}
      </div>
    </div>
  );
}
