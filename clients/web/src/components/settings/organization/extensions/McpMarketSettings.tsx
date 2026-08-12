"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCurrentOrg } from "@/stores/auth";
import type { TranslationFn } from "../GeneralSettings";

interface McpMarketSettingsProps {
  t: TranslationFn;
}

export function McpMarketSettings({ t }: McpMarketSettingsProps) {
  const currentOrg = useCurrentOrg();
  const orgSlug = currentOrg?.slug ?? "";

  return (
    <div className="surface-card p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t("extensions.mcpMarket.title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("extensions.mcpMarket.description")}
        </p>
      </div>
      {orgSlug && (
        <Button asChild>
          <Link href={`/${orgSlug}/connections`}>{t("extensions.mcpMarket.openMarket")}</Link>
        </Button>
      )}
    </div>
  );
}
