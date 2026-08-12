"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ExternalLink, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentStatusBadge } from "@/components/shared/AgentStatusBadge";
import type { TicketPodSummary } from "@/hooks/useTicketPods";
import { getPodDisplayName } from "@/lib/pod-display-name";
import { isPodActive, isPodRelayConnectable } from "@/lib/pod-status";
import { getPodStatusDisplay } from "@/lib/pod-status-display";
import { cn } from "@/lib/utils";
import { useCurrentOrg } from "@/stores/auth";
import { useWorkspaceStore } from "@/stores/workspace";

export function TicketPodItem({ pod }: { pod: TicketPodSummary }) {
  const t = useTranslations();
  const router = useRouter();
  const currentOrg = useCurrentOrg();
  const addPane = useWorkspaceStore((s) => s.addPane);
  const isActive = isPodActive(pod.status);
  const canConnect = isPodRelayConnectable(pod.status);

  const handleConnect = () => {
    addPane(pod.pod_key);
    router.push(`/${currentOrg?.slug}/workspace`);
  };

  const handleOpenInNewTab = () => {
    window.open(`/${currentOrg?.slug}/workspace?pod=${pod.pod_key}`, "_blank");
  };

  return (
    <div
      className={cn(
        "px-2.5 py-1.5 rounded-md flex items-center gap-2 group transition-colors",
        isActive ? "hover:bg-success-bg/50" : "motion-interactive hover:bg-surface-muted",
      )}
    >
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full flex-shrink-0",
          getPodStatusDisplay(pod.status).dotColor,
          (pod.status === "running" || pod.status === "initializing") && "animate-pulse",
        )}
      />

      <code className="text-xs font-mono text-muted-foreground flex-1 truncate">
        {getPodDisplayName(pod)}
      </code>
      <AgentStatusBadge
        agentStatus={pod.agent_status}
        podStatus={pod.status}
        variant="dot"
      />

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {canConnect && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={handleConnect}
            >
              <Terminal className="w-3 h-3 mr-1" />
              {t("tickets.podPanel.connect")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={handleOpenInNewTab}
              title={t("tickets.podPanel.openInNewTab")}
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
