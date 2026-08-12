"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MyConnectionCard } from "./MyConnectionCard";
import { useMyConnections } from "./useMyConnections";

export function MyConnectionsPanel() {
  const t = useTranslations();
  const { connections, loading, toggleEnabled, uninstall, dialogProps } = useMyConnections();

  return (
    <div className="surface-card p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{t("connections.viewMine")}</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("connections.loading")}
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t("connections.noMyConnections")}
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((connection) => (
            <MyConnectionCard
              key={`${connection.repositoryId}-${connection.server.id}`}
              connection={connection}
              onToggle={toggleEnabled}
              onUninstall={uninstall}
            />
          ))}
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
