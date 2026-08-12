"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { McpMarketItem } from "@/lib/api";
import { useTranslations } from "next-intl";
import { connectorAccent, connectorSourceKey } from "./connector-accent";

interface ConnectionMarketCardProps {
  item: McpMarketItem;
  onView: () => void;
  onInstall: () => void;
}

export function ConnectionMarketCard({ item, onView, onInstall }: ConnectionMarketCardProps) {
  const t = useTranslations();
  const name = item.name || item.slug;
  const accent = connectorAccent(item.category || item.slug);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className="group flex flex-col gap-3 rounded-xl border border-border p-4 cursor-pointer transition-all hover:border-primary/40 hover:shadow-sm"
      onClick={onView}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
            accent.bg,
            accent.text,
          )}
        >
          {item.icon || initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{name}</span>
            {item.version && (
              <span className="shrink-0 text-xs text-muted-foreground">v{item.version}</span>
            )}
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">{item.slug}</p>
        </div>
      </div>

      {item.description && (
        <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
          {item.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="text-xs">{item.transport_type}</Badge>
        {item.category && (
          <Badge variant="outline" className="text-xs">{item.category}</Badge>
        )}
        <Badge variant={item.source === "registry" ? "default" : "secondary"} className="text-xs">
          {t(`connections.${connectorSourceKey(item.source)}`)}
        </Badge>
      </div>

      <div className="mt-auto flex items-center justify-end pt-1">
        <Button
          size="sm"
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onInstall();
          }}
        >
          {t("connections.install")}
        </Button>
      </div>
    </div>
  );
}
