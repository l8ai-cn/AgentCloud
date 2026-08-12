"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MyConnection } from "./useMyConnections";

interface MyConnectionCardProps {
  connection: MyConnection;
  onToggle: (connection: MyConnection) => void;
  onUninstall: (connection: MyConnection) => void;
}

export function MyConnectionCard({ connection, onToggle, onUninstall }: MyConnectionCardProps) {
  const t = useTranslations();
  const { server, repositorySlug } = connection;
  const name = server.name || server.slug;
  const commandPreview = server.command
    ? `${server.command}${server.args?.length ? ` ${server.args.join(" ")}` : ""}`
    : server.http_url || "";

  return (
    <div className="surface-card p-4 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-medium truncate">{name}</span>
          <Badge variant="secondary" className="text-xs shrink-0">{server.transport_type}</Badge>
          <Badge variant="outline" className="text-xs shrink-0">{repositorySlug}</Badge>
          <Badge variant={server.is_enabled ? "default" : "secondary"} className="text-xs shrink-0">
            {server.is_enabled ? t("connections.enabled") : t("connections.disabled")}
          </Badge>
        </div>
        {commandPreview && (
          <p className="text-xs text-muted-foreground truncate font-mono">{commandPreview}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Switch
          checked={server.is_enabled}
          onCheckedChange={() => onToggle(connection)}
          aria-label={t("connections.toggleEnabled")}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onUninstall(connection)}
          className="text-destructive hover:text-destructive"
          aria-label={t("connections.uninstall")}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
