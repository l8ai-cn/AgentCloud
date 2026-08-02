"use client";

import { useTranslations } from "next-intl";
import { Network } from "lucide-react";
import { useLoopalSession } from "@/stores/loopalConsole";
import { thinkingKey } from "../loopalThinking";
import { LoopalGoalIndicator } from "./LoopalGoalIndicator";
import { LoopalModeBadge } from "./LoopalModeBadge";

// Loopal-only status. Title, model, connection state and the permission-mode
// picker are intentionally absent: the workbench header and composer bar
// already render those from the session snapshot.
export function LoopalStatusActions({
  podKey,
  onOpenTopology,
}: {
  podKey: string;
  onOpenTopology?: () => void;
}) {
  const t = useTranslations("loopal");
  const { thinking, topology } = useLoopalSession(podKey);
  const thinkKey = thinkingKey(thinking);

  return (
    <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
      <LoopalGoalIndicator podKey={podKey} />
      <LoopalModeBadge podKey={podKey} />
      {thinkKey && (
        <span className="hidden sm:inline" data-testid="loopal-thinking">
          {t("status.thinking", { value: t("thinking." + thinkKey) })}
        </span>
      )}
      {onOpenTopology && topology.length > 0 && (
        <button
          className="rounded p-1 hover:bg-muted hover:text-foreground"
          data-testid="loopal-topbar-topology"
          onClick={onOpenTopology}
          title={t("status.topology")}
          type="button"
        >
          <Network className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
