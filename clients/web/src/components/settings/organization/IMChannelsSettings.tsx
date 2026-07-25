"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, useConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus } from "lucide-react";
import {
  deleteIMConnection,
  listIMConnections,
  listIMProviders,
  updateIMConnection,
  type IMConnection,
  type IMProviderMeta,
  type IMProviderType,
} from "@/lib/api/imChannelApi";
import { IMConnectionCard } from "./im/IMConnectionCard";
import { IMCreateDialog } from "./im/IMCreateDialog";
import { useWeixinQRLogin } from "./im/useWeixinQRLogin";
import { WeixinQRDialog } from "./im/WeixinQRDialog";
import type { TranslationFn } from "./GeneralSettings";

interface IMChannelsSettingsProps {
  t: TranslationFn;
}

export function IMChannelsSettings({ t }: IMChannelsSettingsProps) {
  const [providers, setProviders] = useState<IMProviderMeta[]>([]);
  const [connections, setConnections] = useState<IMConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const { dialogProps, confirm } = useConfirmDialog();

  const providerLabel = useMemo(() => {
    const map = new Map(providers.map((p) => [p.type, p.display_name]));
    return (type: string) => map.get(type as IMProviderType) ?? type;
  }, [providers]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [providerRows, connectionRows] = await Promise.all([
        listIMProviders(),
        listIMConnections(),
      ]);
      setProviders(providerRows);
      setConnections(connectionRows);
    } catch (err) {
      console.error("Failed to load IM channels:", err);
      setError(t("settings.imChannels.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const weixin = useWeixinQRLogin(t, refresh);

  const toggleStatus = async (conn: IMConnection) => {
    const next = conn.status === "active" ? "disabled" : "active";
    try {
      await updateIMConnection(conn.id, { status: next });
      await refresh();
    } catch (err) {
      console.error("Failed to update IM connection:", err);
      setError(t("settings.imChannels.updateFailed"));
    }
  };

  const handleDelete = async (conn: IMConnection) => {
    const ok = await confirm({
      title: t("settings.imChannels.deleteDialog.title"),
      description: t("settings.imChannels.deleteDialog.description", { name: conn.name }),
      variant: "destructive",
      confirmText: t("settings.imChannels.deleteDialog.confirm"),
      cancelText: t("settings.imChannels.deleteDialog.cancel"),
    });
    if (!ok) return;
    try {
      await deleteIMConnection(conn.id);
      await refresh();
    } catch (err) {
      console.error("Failed to delete IM connection:", err);
      setError(t("settings.imChannels.deleteFailed"));
    }
  };

  const alertError = error ?? weixin.error;

  return (
    <div className="space-y-6">
      {alertError && (
        <div
          role="alert"
          className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg flex items-center justify-between"
        >
          <span>{alertError}</span>
          <button
            onClick={() => {
              setError(null);
              weixin.clearError();
            }}
            className="text-sm underline"
          >
            {t("settings.imChannels.dismiss")}
          </button>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("settings.imChannels.title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("settings.imChannels.description")}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t("settings.imChannels.create")}
        </Button>
      </div>

      <div className="surface-card p-6 space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("settings.imChannels.loading")}</p>
        ) : connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("settings.imChannels.empty")}</p>
        ) : (
          connections.map((conn) => (
            <IMConnectionCard
              key={conn.id}
              conn={conn}
              providerLabel={providerLabel}
              t={t}
              onToggle={toggleStatus}
              onDelete={handleDelete}
              onWeixinLogin={weixin.start}
              onError={setError}
              onRefresh={refresh}
              qrLoading={weixin.qrLoading}
            />
          ))
        )}
      </div>

      <IMCreateDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        providers={providers}
        t={t}
        onCreated={refresh}
        onError={setError}
      />

      <WeixinQRDialog
        open={Boolean(weixin.qrSessionId)}
        imageUrl={weixin.qrImageUrl}
        message={weixin.qrMessage}
        status={weixin.qrStatus}
        t={t}
        onClose={weixin.close}
      />

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
