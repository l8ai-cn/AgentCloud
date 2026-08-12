"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import type { McpMarketItem } from "@/lib/api";
import { ConnectionMarketCard } from "./ConnectionMarketCard";
import { ConnectionMarketDetailDrawer } from "./ConnectionMarketDetailDrawer";
import { ConnectionInstallDialog } from "./ConnectionInstallDialog";
import { useConnectionMarket } from "./useConnectionMarket";

export function ConnectionMarketPanel() {
  const t = useTranslations();
  const market = useConnectionMarket();
  const [detailItem, setDetailItem] = useState<McpMarketItem | null>(null);
  const [installItem, setInstallItem] = useState<McpMarketItem | null>(null);

  const openInstall = (item: McpMarketItem) => {
    setDetailItem(null);
    setInstallItem(item);
  };

  return (
    <>
      <div className="surface-card p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{t("connections.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("connections.description")}</p>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("connections.searchPlaceholder")}
            value={market.search}
            onChange={(e) => market.setSearch(e.target.value)}
          />
        </div>

        {market.categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              size="sm"
              variant={market.category == null ? "default" : "outline"}
              onClick={() => market.setCategory(null)}
            >
              {t("connections.allCategories")}
            </Button>
            {market.categories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={market.category === cat ? "default" : "outline"}
                onClick={() => market.setCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        )}

        {market.loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("connections.loading")}
          </div>
        ) : market.items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">{t("connections.noConnectors")}</div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              {market.total} {t("connections.connectorsFound")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {market.items.map((item) => (
                <ConnectionMarketCard
                  key={item.id}
                  item={item}
                  onView={() => setDetailItem(item)}
                  onInstall={() => openInstall(item)}
                />
              ))}
            </div>
            {market.hasMore && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={market.loadMore}
                  disabled={market.loadingMore}
                >
                  {market.loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t("connections.loading")}
                    </>
                  ) : (
                    t("connections.loadMore", { current: market.items.length, total: market.total })
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <ConnectionMarketDetailDrawer
        item={detailItem}
        open={detailItem != null}
        onOpenChange={(next) => {
          if (!next) setDetailItem(null);
        }}
        onInstall={openInstall}
      />

      <ConnectionInstallDialog
        item={installItem}
        open={installItem != null}
        onOpenChange={(next) => {
          if (!next) setInstallItem(null);
        }}
      />
    </>
  );
}
