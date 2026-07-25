"use client";

import { useEffect, useState } from "react";

import { MarketingPageShell } from "@/components/landing/expert-pages/MarketingPageShell";
import {
  fetchPublicMarketApplications,
  type PublicMarketApplication,
} from "@/lib/public-market-api";
import { MarketplaceApplicationBrowser } from "./MarketplaceApplicationBrowser";

export function PublicMarketplacePage() {
  const [applications, setApplications] = useState<PublicMarketApplication[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicMarketApplications()
      .then(({ items }) => setApplications(items))
      .catch((cause: unknown) => {
        setLoadError(cause instanceof Error ? cause.message : "市场内容加载失败");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <MarketingPageShell>
      <MarketplaceApplicationBrowser
        applications={applications}
        loadError={loadError}
        loading={loading}
      />
    </MarketingPageShell>
  );
}
