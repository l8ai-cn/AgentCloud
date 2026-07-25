"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2 } from "lucide-react";
import {
  updateIMConnection,
  type IMDMPolicy,
  type IMGroupPolicy,
  type IMConnection,
} from "@/lib/api/imChannelApi";
import { IMRouteBindingsPanel } from "./IMRouteBindingsPanel";
import { IMPolicyControls } from "./IMPolicyControls";
import { IMIdentityBindingsPanel } from "./IMIdentityBindingsPanel";
import { isWeixinProvider } from "./weixin-provider";
import type { TranslationFn } from "../GeneralSettings";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  disabled: "secondary",
  error: "destructive",
};

function isWeixinLoggedIn(conn: IMConnection) {
  const cfg = conn.config as Record<string, unknown> | undefined;
  return Boolean(cfg?.bot_token);
}

interface IMConnectionCardProps {
  conn: IMConnection;
  providerLabel: (type: string) => string;
  t: TranslationFn;
  onToggle: (conn: IMConnection) => void;
  onDelete: (conn: IMConnection) => void;
  onWeixinLogin: (conn: IMConnection) => void;
  onError: (msg: string) => void;
  onRefresh: () => Promise<void>;
  qrLoading: boolean;
}

export function IMConnectionCard({
  conn,
  providerLabel,
  t,
  onToggle,
  onDelete,
  onWeixinLogin,
  onError,
  onRefresh,
  qrLoading,
}: IMConnectionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const savePolicy = async (patch: {
    dm_policy?: IMDMPolicy;
    group_policy?: IMGroupPolicy;
  }) => {
    try {
      await updateIMConnection(conn.id, patch);
      await onRefresh();
    } catch (err) {
      console.error("Failed to update IM policy:", err);
      onError(t("settings.imChannels.updateFailed"));
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{conn.name}</h3>
            <Badge variant={STATUS_VARIANT[conn.status] ?? "secondary"}>
              {t(`settings.imChannels.status.${conn.status}`)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {providerLabel(conn.provider)}
            {conn.channel_id
              ? ` · ${t("settings.imChannels.boundChannel", { id: conn.channel_id })}`
              : ""}
          </p>
          {conn.last_error && (
            <p className="text-sm text-destructive mt-2">{conn.last_error}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isWeixinProvider(conn.provider) && !isWeixinLoggedIn(conn) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onWeixinLogin(conn)}
              disabled={qrLoading}
            >
              {t("settings.imChannels.weixin.qrLogin")}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onToggle(conn)}>
            {conn.status === "active"
              ? t("settings.imChannels.disable")
              : t("settings.imChannels.enable")}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(conn)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>

      {isWeixinProvider(conn.provider) ? (
        <p className="text-xs text-muted-foreground">
          {isWeixinLoggedIn(conn)
            ? t("settings.imChannels.weixin.loggedIn")
            : t("settings.imChannels.weixin.loginRequired")}
        </p>
      ) : conn.webhook_url ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            {t("settings.imChannels.webhookUrl")}
          </Label>
          <div className="flex gap-2">
            <Input readOnly value={conn.webhook_url} className="font-mono text-xs" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigator.clipboard.writeText(conn.webhook_url ?? "")}
              title={t("settings.imChannels.copyWebhook")}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {t("settings.imChannels.policy.dm")}: {conn.dm_policy ?? "pairing"} ·{" "}
          {t("settings.imChannels.policy.group")}: {conn.group_policy ?? "allowlist"}
        </p>
        <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded
            ? t("settings.imChannels.manage.hide")
            : t("settings.imChannels.manage.show")}
        </Button>
      </div>

      {expanded && (
        <div className="space-y-4 border-t pt-3">
          <IMPolicyControls conn={conn} t={t} onChange={savePolicy} />
          <IMIdentityBindingsPanel connectionId={conn.id} t={t} onError={onError} />
          <IMRouteBindingsPanel connectionId={conn.id} t={t} onError={onError} />
        </div>
      )}
    </div>
  );
}
