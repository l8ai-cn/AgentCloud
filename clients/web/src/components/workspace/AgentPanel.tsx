"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  WorkerConversation,
  WorkerProvider,
  createBuiltinContentRenderers,
  createBuiltinToolRenderers,
} from "@agent-cloud/agent-ui";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { useWorkspaceStore, type SplitDirection } from "@/stores/workspace";
import { AgentPanelHeader } from "./AgentPanelHeader";
import { PodSelectorModal } from "./PodSelectorModal";
import { WorkerControlOverlay } from "@/components/mobile-worker/WorkerControlOverlay";
import { usePodWorkerSession } from "./agent-ui/usePodWorkerSession";

const AGENT_CONTENT_RENDERERS = createBuiltinContentRenderers();
const AGENT_TOOL_RENDERERS = createBuiltinToolRenderers();

interface AgentPanelProps {
  paneId: string;
  podKey: string;
  isActive: boolean;
  onClose?: () => void;
  onMaximize?: () => void;
  onPopout?: () => void;
  showHeader?: boolean;
  controlClientLabel?: string;
  className?: string;
}

export function AgentPanel({
  paneId,
  podKey,
  isActive,
  onClose,
  onMaximize,
  onPopout,
  showHeader = true,
  controlClientLabel = "desktop",
  className,
}: AgentPanelProps) {
  const locale = useLocale();
  const [isMaximized, setIsMaximized] = useState(false);
  const [pendingSplitDirection, setPendingSplitDirection] =
    useState<SplitDirection | null>(null);

  const setActivePane = useWorkspaceStore((s) => s.setActivePane);
  const splitPane = useWorkspaceStore((s) => s.splitPane);
  const panes = useWorkspaceStore((s) => s.panes);
  const session = usePodWorkerSession(podKey, controlClientLabel);

  const openPodKeys = useMemo(() => panes.map((p) => p.podKey), [panes]);

  const handleFocus = useCallback(() => {
    setActivePane(paneId);
  }, [paneId, setActivePane]);

  const handleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev);
    onMaximize?.();
  }, [onMaximize]);

  return (
    <div
      className={cn(
        "relative flex flex-col h-full bg-background rounded-lg overflow-hidden border",
        isActive ? "border-primary" : "border-border",
        isMaximized && "fixed inset-4 z-50",
        !showHeader && session.controlLease.status !== "granted" && "max-sm:pb-20",
        className
      )}
      onClick={handleFocus}
    >
      {showHeader && (
        <AgentPanelHeader
          podKey={podKey}
          isMaximized={isMaximized}
          onPopout={onPopout}
          onSplitRight={() => setPendingSplitDirection("horizontal")}
          onSplitDown={() => setPendingSplitDirection("vertical")}
          onMaximize={handleMaximize}
          onClose={onClose}
        />
      )}

      <WorkerProvider client={session.workerClient}>
        <WorkerConversation
          className="flex-1"
          clientLabel={controlClientLabel}
          contentRenderers={AGENT_CONTENT_RENDERERS}
          locale={locale === "zh" ? "zh-CN" : "en-US"}
          presentation="developer"
          terminalRuntime={session.terminalRuntime}
          toolRenderers={AGENT_TOOL_RENDERERS}
          workerRef={session.workerRef}
          workspaceArtifacts={session.workspaceArtifacts}
        />
      </WorkerProvider>

      {session.liveSession && (
        <WorkerControlOverlay
          blocking={false}
          lease={session.controlLease}
          preserveHeader={showHeader}
        />
      )}

      {pendingSplitDirection && (
        <PodSelectorModal
          openPodKeys={openPodKeys}
          onSelect={(selectedPodKey) => {
            splitPane(paneId, pendingSplitDirection, selectedPodKey);
            setPendingSplitDirection(null);
          }}
          onClose={() => setPendingSplitDirection(null)}
        />
      )}
    </div>
  );
}

export default AgentPanel;
