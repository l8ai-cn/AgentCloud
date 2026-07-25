"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createIMConnection,
  IM_CONFIG_EXAMPLES,
  type IMProviderMeta,
  type IMProviderType,
} from "@/lib/api/imChannelApi";
import type { TranslationFn } from "../GeneralSettings";

function isWeixinProvider(type: string) {
  return type === "weixin" || type === "wechat";
}

interface IMCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: IMProviderMeta[];
  t: TranslationFn;
  onCreated: () => Promise<void>;
  onError: (msg: string) => void;
}

export function IMCreateDialog({
  open,
  onOpenChange,
  providers,
  t,
  onCreated,
  onError,
}: IMCreateDialogProps) {
  const [provider, setProvider] = useState<IMProviderType>("feishu");
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [config, setConfig] = useState(
    JSON.stringify(IM_CONFIG_EXAMPLES.feishu, null, 2)
  );
  const [creating, setCreating] = useState(false);

  const onProviderChange = (value: IMProviderType) => {
    setProvider(value);
    const key = isWeixinProvider(value) ? "weixin" : value;
    setConfig(JSON.stringify(IM_CONFIG_EXAMPLES[key as IMProviderType] ?? {}, null, 2));
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const parsed = isWeixinProvider(provider)
        ? {}
        : (JSON.parse(config) as Record<string, unknown>);
      await createIMConnection({
        provider: isWeixinProvider(provider) ? "weixin" : provider,
        name: name.trim(),
        channel_id: channelId ? Number(channelId) : undefined,
        config: parsed,
        status: "disabled",
        dm_policy: "pairing",
        group_policy: "allowlist",
      });
      onOpenChange(false);
      setName("");
      setChannelId("");
      await onCreated();
    } catch (err) {
      console.error("Failed to create IM connection:", err);
      onError(t("settings.imChannels.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("settings.imChannels.createDialog.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("settings.imChannels.createDialog.provider")}</Label>
            <Select value={provider} onValueChange={(v) => onProviderChange(v as IMProviderType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.type} value={p.type}>
                    {p.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("settings.imChannels.createDialog.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("settings.imChannels.createDialog.channelId")}</Label>
            <Input
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder={t("settings.imChannels.createDialog.channelIdPlaceholder")}
            />
          </div>
          {!isWeixinProvider(provider) ? (
            <div className="space-y-2">
              <Label>{t("settings.imChannels.createDialog.config")}</Label>
              <Textarea
                value={config}
                onChange={(e) => setConfig(e.target.value)}
                rows={10}
                className="font-mono text-xs"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("settings.imChannels.weixin.createHint")}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("settings.imChannels.createDialog.cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim()}>
            {t("settings.imChannels.createDialog.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
