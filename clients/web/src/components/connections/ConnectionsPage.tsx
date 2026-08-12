"use client";

import { useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectionMarketPanel } from "./ConnectionMarketPanel";
import { MyConnectionsPanel } from "./MyConnectionsPanel";

export function ConnectionsPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgSlug = params.org as string;
  const view = searchParams.get("view") === "mine" ? "mine" : "market";

  const setView = useCallback(
    (next: string) => {
      const href =
        next === "mine" ? `/${orgSlug}/connections?view=mine` : `/${orgSlug}/connections`;
      router.replace(href);
    },
    [orgSlug, router],
  );

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl space-y-4">
        <Tabs value={view} onValueChange={setView} className="w-full">
          <TabsList>
            <TabsTrigger value="market">{t("connections.viewMarket")}</TabsTrigger>
            <TabsTrigger value="mine">{t("connections.viewMine")}</TabsTrigger>
          </TabsList>
          <TabsContent value="market" className="mt-4">
            <ConnectionMarketPanel />
          </TabsContent>
          <TabsContent value="mine" className="mt-4">
            <MyConnectionsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
