"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listIMIdentityBindings,
  type IMIdentityBinding,
} from "@/lib/api/imChannelBindingsApi";
import type { TranslationFn } from "../GeneralSettings";

interface IMIdentityBindingsPanelProps {
  connectionId: number;
  t: TranslationFn;
  onError: (msg: string) => void;
}

export function IMIdentityBindingsPanel({
  connectionId,
  t,
  onError,
}: IMIdentityBindingsPanelProps) {
  const [rows, setRows] = useState<IMIdentityBinding[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listIMIdentityBindings(connectionId));
    } catch (err) {
      console.error("Failed to load IM bindings:", err);
      onError(t("settings.imChannels.bindings.loadError"));
    } finally {
      setLoading(false);
    }
  }, [connectionId, onError, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-2">
      <div>
        <h4 className="text-sm font-medium">{t("settings.imChannels.bindings.title")}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("settings.imChannels.bindings.description")}
        </p>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">{t("settings.imChannels.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("settings.imChannels.bindings.empty")}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => (
            <li key={row.id} className="text-xs font-mono border rounded-md px-3 py-2">
              {row.external_name || row.external_user_id} · {row.status}
              {row.user_id ? ` · user#${row.user_id}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
