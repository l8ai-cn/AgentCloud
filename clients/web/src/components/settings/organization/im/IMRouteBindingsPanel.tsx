"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import {
  createIMRouteBinding,
  deleteIMRouteBinding,
  listIMRouteBindings,
  type IMRouteBinding,
} from "@/lib/api/imChannelBindingsApi";
import type { TranslationFn } from "../GeneralSettings";

interface IMRouteBindingsPanelProps {
  connectionId: number;
  t: TranslationFn;
  onError: (msg: string) => void;
}

export function IMRouteBindingsPanel({
  connectionId,
  t,
  onError,
}: IMRouteBindingsPanelProps) {
  const [routes, setRoutes] = useState<IMRouteBinding[]>([]);
  const [targetRef, setTargetRef] = useState("");
  const [peerKind, setPeerKind] = useState("any");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRoutes(await listIMRouteBindings(connectionId));
    } catch (err) {
      console.error("Failed to load IM routes:", err);
      onError(t("settings.imChannels.routes.loadError"));
    } finally {
      setLoading(false);
    }
  }, [connectionId, onError, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addRoute = async () => {
    const ref = targetRef.trim().toLowerCase();
    if (!ref) return;
    setSaving(true);
    try {
      await createIMRouteBinding(connectionId, {
        peer_kind: peerKind,
        target_kind: "pod",
        target_ref: ref,
      });
      setTargetRef("");
      await refresh();
    } catch (err) {
      console.error("Failed to create IM route:", err);
      onError(t("settings.imChannels.routes.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  const removeRoute = async (routeId: number) => {
    try {
      await deleteIMRouteBinding(connectionId, routeId);
      await refresh();
    } catch (err) {
      console.error("Failed to delete IM route:", err);
      onError(t("settings.imChannels.routes.deleteFailed"));
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium">{t("settings.imChannels.routes.title")}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("settings.imChannels.routes.description")}
        </p>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">{t("settings.imChannels.loading")}</p>
      ) : routes.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("settings.imChannels.routes.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {routes.map((route) => (
            <li
              key={route.id}
              className="flex items-center justify-between gap-2 text-sm border rounded-md px-3 py-2"
            >
              <span className="font-mono text-xs">
                {route.peer_kind}
                {route.peer_id ? `:${route.peer_id}` : ""} → @{route.target_ref}
              </span>
              <Button variant="ghost" size="icon" onClick={() => removeRoute(route.id)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">{t("settings.imChannels.routes.peerKind")}</Label>
          <Input
            value={peerKind}
            onChange={(e) => setPeerKind(e.target.value)}
            className="w-28 h-8 text-xs"
            placeholder="any"
          />
        </div>
        <div className="space-y-1 flex-1 min-w-[140px]">
          <Label className="text-xs">{t("settings.imChannels.routes.workerSlug")}</Label>
          <Input
            value={targetRef}
            onChange={(e) => setTargetRef(e.target.value)}
            className="h-8 text-xs font-mono"
            placeholder="code-reviewer"
          />
        </div>
        <Button size="sm" onClick={addRoute} disabled={saving || !targetRef.trim()}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          {t("settings.imChannels.routes.add")}
        </Button>
      </div>
    </div>
  );
}
