"use client";

import { cn } from "@/lib/utils";
import { getPodDisplayName } from "@/lib/pod-display-name";
import { getPodStatusDisplay } from "@/lib/pod-status-display";
import { Pod } from "@/stores/pod";
import { AgentStatusBadge } from "@/components/shared/AgentStatusBadge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import {
  Terminal,
  Smartphone,
} from "lucide-react";
import { SidebarPodContextMenu } from "./SidebarPodContextMenu";
import { SidebarPodActionsMenu } from "./SidebarPodActionsMenu";

interface PodListItemProps {
  pod: Pod;
  isOpen: boolean;
  onClick: () => void;
  onTerminate: () => void;
  onDelete: () => void;
  onWake: () => void;
  onRename: () => void;
  onShare: () => void;
  onOpenMobile: () => void;
  onPublishExpert?: () => void;
  onTogglePerpetual: (perpetual: boolean) => void;
}

export function PodListItem({ pod, isOpen, onClick, onTerminate, onDelete, onWake, onRename, onShare, onOpenMobile, onPublishExpert, onTogglePerpetual }: PodListItemProps) {
  const t = useTranslations("mobile.access");
  const status = getPodStatusDisplay(pod.status);
  const StatusIcon = status.icon;

  return (
    <SidebarPodContextMenu
      pod={pod}
      onRename={onRename}
      onShare={onShare}
      onOpenMobile={onOpenMobile}
      onPublishExpert={onPublishExpert}
      onTerminate={onTerminate}
      onDelete={onDelete}
      onWake={onWake}
      onTogglePerpetual={onTogglePerpetual}
    >
      <div
        data-testid="pod-list-item"
        data-pod-key={pod.pod_key}
        className={cn(
          "group flex items-center gap-2 px-3 py-2 motion-interactive hover:bg-surface-muted cursor-pointer",
          isOpen && "bg-muted/30"
        )}
        onClick={onClick}
      >
        <div className={cn("flex items-center justify-center", status.color)}>
          <StatusIcon className={cn("h-3 w-3", status.spin && "animate-spin")} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm truncate font-mono">
              {getPodDisplayName(pod)}
            </span>
            <AgentStatusBadge
              agentStatus={pod.agent_status ?? ''}
              podStatus={pod.status}
              variant="dot"
            />
            {isOpen && (
              <Terminal className="w-3 h-3 text-primary flex-shrink-0" />
            )}
          </div>
          {pod.created_by?.name && (
            <p className="text-xs text-muted-foreground truncate">
              {pod.created_by.name}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          title={t("mobileAccess")}
          aria-label={t("mobileAccess")}
          onClick={(event) => {
            event.stopPropagation();
            onOpenMobile();
          }}
        >
          <Smartphone className="h-4 w-4" />
        </Button>
        <SidebarPodActionsMenu
          pod={pod}
          onOpenMobile={onOpenMobile}
          onPublishExpert={onPublishExpert}
          onDelete={onDelete}
          onWake={onWake}
          onRename={onRename}
          onShare={onShare}
          onTerminate={onTerminate}
          onTogglePerpetual={onTogglePerpetual}
        />
      </div>
    </SidebarPodContextMenu>
  );
}
