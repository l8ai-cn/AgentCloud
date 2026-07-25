"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IMDMPolicy, IMGroupPolicy, IMConnection } from "@/lib/api/imChannelApi";
import type { TranslationFn } from "../GeneralSettings";

interface IMPolicyControlsProps {
  conn: IMConnection;
  t: TranslationFn;
  onChange: (patch: { dm_policy?: IMDMPolicy; group_policy?: IMGroupPolicy }) => void;
}

export function IMPolicyControls({ conn, t, onChange }: IMPolicyControlsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">{t("settings.imChannels.policy.dm")}</Label>
        <Select
          value={conn.dm_policy ?? "pairing"}
          onValueChange={(v) => onChange({ dm_policy: v as IMDMPolicy })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["pairing", "open", "allowlist", "disabled", "guest"] as const).map((v) => (
              <SelectItem key={v} value={v}>
                {t(`settings.imChannels.policy.dmOptions.${v}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t("settings.imChannels.policy.group")}</Label>
        <Select
          value={conn.group_policy ?? "allowlist"}
          onValueChange={(v) => onChange({ group_policy: v as IMGroupPolicy })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["open", "allowlist", "disabled"] as const).map((v) => (
              <SelectItem key={v} value={v}>
                {t(`settings.imChannels.policy.groupOptions.${v}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
