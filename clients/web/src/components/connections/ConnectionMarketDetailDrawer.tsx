"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { McpMarketItem } from "@/lib/api";
import { useTranslations } from "next-intl";
import { connectorSourceKey } from "./connector-accent";

interface ConnectionMarketDetailDrawerProps {
  item: McpMarketItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: (item: McpMarketItem) => void;
}

export function ConnectionMarketDetailDrawer({
  item,
  open,
  onOpenChange,
  onInstall,
}: ConnectionMarketDetailDrawerProps) {
  const t = useTranslations();
  if (!item) return null;

  const name = item.name || item.slug;
  const commandPreview = item.command
    ? `${item.command}${item.default_args?.length ? ` ${item.default_args.join(" ")}` : ""}`
    : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{name}</SheetTitle>
          <p className="text-xs text-muted-foreground">{t("connections.mcpSubtitle")}</p>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{item.transport_type}</Badge>
            {item.category && <Badge variant="outline">{item.category}</Badge>}
            <Badge variant={item.source === "registry" ? "default" : "secondary"}>
              {t(`connections.${connectorSourceKey(item.source)}`)}
            </Badge>
            {item.version && <Badge variant="outline">v{item.version}</Badge>}
          </div>

          {item.description ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">{t("connections.noDescription")}</p>
          )}

          <dl className="space-y-3 text-sm">
            <DetailRow label={t("connections.transportType")} value={item.transport_type} />
            {commandPreview && <DetailRow label={t("connections.command")} value={commandPreview} mono />}
            {item.default_http_url && (
              <DetailRow label={t("connections.httpUrl")} value={item.default_http_url} mono />
            )}
            <DetailRow
              label={t("connections.source")}
              value={item.registry_name || t(`connections.${connectorSourceKey(item.source)}`)}
            />
            <div>
              <dt className="text-muted-foreground mb-1">{t("connections.agentFilter")}</dt>
              <dd className="flex flex-wrap gap-1">
                {(item.agent_filter?.length ?? 0) > 0 ? (
                  item.agent_filter!.map((agent) => (
                    <Badge key={agent} variant="outline" className="text-xs">{agent}</Badge>
                  ))
                ) : (
                  <span className="text-sm">{t("connections.agentFilterAll")}</span>
                )}
              </dd>
            </div>
            {(item.env_var_schema?.length ?? 0) > 0 && (
              <div>
                <dt className="text-muted-foreground mb-1">{t("connections.envVars")}</dt>
                <dd className="flex flex-wrap gap-1">
                  {item.env_var_schema!.map((entry) => (
                    <Badge key={entry.name} variant={entry.required ? "default" : "outline"} className="text-xs">
                      {entry.name}{entry.required ? " *" : ""}
                    </Badge>
                  ))}
                </dd>
              </div>
            )}
          </dl>

          <Button className="w-full" onClick={() => onInstall(item)}>
            {t("connections.install")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground mb-1">{label}</dt>
      <dd className={mono ? "font-mono text-xs break-all" : "break-all"}>{value}</dd>
    </div>
  );
}
