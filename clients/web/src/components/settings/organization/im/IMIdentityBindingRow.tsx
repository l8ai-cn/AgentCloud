"use client";

import { Button } from "@/components/ui/button";
import { Ban, RotateCcw, Trash2 } from "lucide-react";
import type { IMBindingStatus, IMIdentityBinding } from "@/lib/api/imChannelBindingsApi";
import type { TranslationFn } from "../GeneralSettings";

interface IMIdentityBindingRowProps {
  binding: IMIdentityBinding;
  busy: boolean;
  t: TranslationFn;
  onSetStatus: (status: IMBindingStatus) => void;
  onDelete: () => void;
}

function accountLabel(binding: IMIdentityBinding): string | null {
  if (binding.user_name) return binding.user_name;
  if (binding.user_email) return binding.user_email;
  return binding.user_id ? `user#${binding.user_id}` : null;
}

export function IMIdentityBindingRow({
  binding,
  busy,
  t,
  onSetStatus,
  onDelete,
}: IMIdentityBindingRowProps) {
  const account = accountLabel(binding);
  const blocked = binding.status === "blocked";

  return (
    <li className="flex items-center justify-between gap-2 border rounded-md px-3 py-2">
      <div className="min-w-0">
        <div className="text-sm truncate">
          {binding.external_name || binding.external_user_id}
          {account ? <span className="text-muted-foreground"> → {account}</span> : null}
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          {t(`settings.imChannels.bindings.status.${binding.status}`)} · {binding.external_user_id}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          disabled={busy}
          title={
            blocked
              ? t("settings.imChannels.bindings.unblock")
              : t("settings.imChannels.bindings.block")
          }
          onClick={() =>
            onSetStatus(blocked ? (binding.user_id ? "bound" : "pending") : "blocked")
          }
        >
          {blocked ? (
            <RotateCcw className="w-3.5 h-3.5" />
          ) : (
            <Ban className="w-3.5 h-3.5 text-amber-600" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={busy}
          title={t("settings.imChannels.bindings.unbind")}
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </div>
    </li>
  );
}
