"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteIMIdentityBinding,
  listIMIdentityBindings,
  setIMIdentityBindingStatus,
  type IMBindingStatus,
  type IMIdentityBinding,
} from "@/lib/api/imChannelBindingsApi";
import { IMIdentityBindingRow } from "./IMIdentityBindingRow";
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
  const [busyId, setBusyId] = useState<number | null>(null);

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

  const mutate = useCallback(
    async (bindingId: number, action: () => Promise<unknown>, errorKey: string) => {
      setBusyId(bindingId);
      try {
        await action();
        await refresh();
      } catch (err) {
        console.error("Failed to update IM binding:", err);
        onError(t(errorKey));
      } finally {
        setBusyId(null);
      }
    },
    [onError, refresh, t]
  );

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
            <IMIdentityBindingRow
              key={row.id}
              binding={row}
              busy={busyId === row.id}
              t={t}
              onSetStatus={(status: IMBindingStatus) =>
                mutate(
                  row.id,
                  () => setIMIdentityBindingStatus(connectionId, row.id, status),
                  "settings.imChannels.bindings.updateFailed"
                )
              }
              onDelete={() =>
                mutate(
                  row.id,
                  () => deleteIMIdentityBinding(connectionId, row.id),
                  "settings.imChannels.bindings.deleteFailed"
                )
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
