"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  WorkerClient,
  WorkerConversation,
  WorkerProvider,
  createBuiltinContentRenderers,
  createBuiltinToolRenderers,
} from "@agent-cloud/agent-ui";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import { useWorkspaceStore, type SplitDirection } from "@/stores/workspace";
import { usePod, usePodStore } from "@/stores/pod";
import { useAcpRelay } from "@/hooks/useAcpRelay";
import { AgentPanelHeader } from "./AgentPanelHeader";
import { PodSelectorModal } from "./PodSelectorModal";
import { WorkerControlOverlay } from "@/components/mobile-worker/WorkerControlOverlay";
import { useWorkerControlLease } from "@/hooks/useWorkerControlLease";
import { createPodWorkerTransport } from "./agent-ui/podWorkerTransport";
import { usePodWorkspaceArtifacts } from "./agent-ui/usePodWorkspaceArtifacts";

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
  const pod = usePod(podKey);
  const controlLease = useWorkerControlLease(podKey, controlClientLabel);

  const openPodKeys = useMemo(() => panes.map((p) => p.podKey), [panes]);
  const podStatus = pod?.status ?? "unknown";
  const liveSession = podStatus === "running";
  const canReadSession =
    liveSession || podStatus === "completed" || podStatus === "orphaned";
  const workspaceArtifacts = usePodWorkspaceArtifacts(podKey, canReadSession);
  useAcpRelay(podKey, paneId, liveSession);

  const latchRef = useRef({
    controlGranted: false,
    workspaceArtifactError: null as string | null,
  });

  const workerRef = useMemo(
    () => ({ transport: "pod" as const, podKey }),
    [podKey],
  );

  /* Transport getters close over a stable latch updated in the effect below. */
  /* eslint-disable react-hooks/refs */
  const workerClient = useMemo(() => {
    const client = new WorkerClient();
    client.register(
      createPodWorkerTransport({
        isControlGranted: () => latchRef.current.controlGranted,
        getInitProgressMessage: (key) => {
          const progress = usePodStore.getState().initProgress[key];
          if (!progress) return null;
          return progress.message || `${progress.phase} - ${progress.progress}%`;
        },
        getWorkspaceArtifactError: () => latchRef.current.workspaceArtifactError,
      }),
    );
    return client;
  }, [podKey]);
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    latchRef.current = {
      controlGranted: controlLease.status === "granted",
      workspaceArtifactError: workspaceArtifacts.error,
    };
    usePodStore.setState((state) => ({ _tick: state._tick + 1 }));
  }, [controlLease.status, workspaceArtifacts.error]);

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
        !showHeader && controlLease.status !== "granted" && "max-sm:pb-20",
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

      <WorkerProvider client={workerClient}>
        <WorkerConversation
          className="flex-1"
          clientLabel={controlClientLabel}
          contentRenderers={AGENT_CONTENT_RENDERERS}
          locale={locale === "zh" ? "zh-CN" : "en-US"}
          presentation="developer"
          toolRenderers={AGENT_TOOL_RENDERERS}
          workerRef={workerRef}
          workspaceArtifacts={workspaceArtifacts.artifacts}
        />
      </WorkerProvider>

      {liveSession && (
        <WorkerControlOverlay
          blocking={false}
          lease={controlLease}
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
