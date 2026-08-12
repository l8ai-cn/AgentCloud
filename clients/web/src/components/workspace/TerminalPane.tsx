"use client";

import React, { useCallback, useEffect, useState, useRef, useMemo } from "react";
import "@xterm/xterm/css/xterm.css";
import { cn } from "@/lib/utils";
import { useWorkspaceStore, type SplitDirection } from "@/stores/workspace";
import { usePodStore } from "@/stores/pod";
import { useAutopilotControllerByPodKey } from "@/stores/autopilot";
import { usePodStatus, useTerminal, useTouchScroll } from "@/hooks";
import { useWakeWorker } from "@/hooks/useWakeWorker";
import { TerminalPaneHeader } from "./TerminalPaneHeader";
import { TerminalPanePlaceholder } from "./TerminalPanePlaceholder";
import { RunnerRestartOverlay } from "./RunnerRestartOverlay";
import { RelayStatusOverlay } from "./RelayStatusOverlay";
import { AutopilotOverlay } from "./AutopilotOverlay";
import { AutopilotStartButton } from "./AutopilotStartButton";
import { PodSelectorModal } from "./PodSelectorModal";
import { WorkerControlOverlay } from "@/components/mobile-worker/WorkerControlOverlay";
import { useWorkerControlLease } from "@/hooks/useWorkerControlLease";

interface TerminalPaneProps {
  paneId: string;
  podKey: string;
  isActive: boolean;
  onClose?: () => void;
  onMaximize?: () => void;
  onPopout?: () => void;
  showHeader?: boolean;
  allowSplit?: boolean;
  controlClientLabel?: string;
  className?: string;
}

export function TerminalPane({
  paneId,
  podKey,
  isActive,
  onClose,
  onMaximize,
  onPopout,
  showHeader = true,
  allowSplit = true,
  controlClientLabel = "desktop",
  className,
}: TerminalPaneProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [pendingSplitDirection, setPendingSplitDirection] = useState<SplitDirection | null>(null);
  const triggerAutopilotRef = useRef<(() => void) | null>(null);
  const maximizeRafRef = useRef<number | undefined>(undefined);
  const terminalFontSize = useWorkspaceStore((s) => s.terminalFontSize);
  const setActivePane = useWorkspaceStore((s) => s.setActivePane);
  const splitPane = useWorkspaceStore((s) => s.splitPane);
  const panes = useWorkspaceStore((s) => s.panes);
  const initProgress = usePodStore((state) => state.initProgress[podKey]);
  const wakeWorker = useWakeWorker();
  const hasAutopilot = !!useAutopilotControllerByPodKey(podKey);
  const openPodKeys = useMemo(() => panes.map((p) => p.podKey), [panes]);
  const { podStatus, isPodReady, podError } = usePodStatus(podKey);
  const controlLease = useWorkerControlLease(podKey, controlClientLabel);
  const [showTerminal, setShowTerminal] = useState(false);
  if (isPodReady && !showTerminal) {
    setShowTerminal(true);
  }

  const {
    terminalRef,
    xtermRef,
    connectionStatus,
    isRunnerDisconnected,
    syncSize,
  } = useTerminal(podKey, terminalFontSize, showTerminal, isActive);

  useTouchScroll(terminalRef, xtermRef, showTerminal);

  const handleFocus = useCallback(() => {
    setActivePane(paneId);
  }, [paneId, setActivePane]);

  const handleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev);
    onMaximize?.();
    if (maximizeRafRef.current !== undefined) cancelAnimationFrame(maximizeRafRef.current);
    maximizeRafRef.current = requestAnimationFrame(() => {
      maximizeRafRef.current = undefined;
      syncSize();
    });
  }, [onMaximize, syncSize]);

  const handleWake = useCallback(() => {
    void wakeWorker(podKey);
  }, [podKey, wakeWorker]);

  useEffect(() => {
    return () => {
      if (maximizeRafRef.current !== undefined) cancelAnimationFrame(maximizeRafRef.current);
    };
  }, []);

  return (
    <div
      className={cn(
        "relative flex flex-col h-full bg-terminal-bg rounded-lg overflow-hidden ring-1 transition-shadow",
        isActive
          ? "ring-primary/70 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_30%,transparent),0_18px_48px_rgba(0,0,0,0.28)]"
          : "ring-terminal-border/70",
        isMaximized && "fixed inset-4 z-50 shadow-2xl",
        className
      )}
      onClick={handleFocus}
    >
      {showHeader && (
        <TerminalPaneHeader
          podKey={podKey}
          connectionStatus={connectionStatus}
          isRunnerDisconnected={isRunnerDisconnected}
          isMaximized={isMaximized}
          isPodReady={isPodReady}
          hasAutopilot={hasAutopilot}
          onSyncSize={syncSize}
          onStartAutopilot={() => triggerAutopilotRef.current?.()}
          onPopout={onPopout}
          onSplitRight={allowSplit ? () => setPendingSplitDirection("horizontal") : undefined}
          onSplitDown={allowSplit ? () => setPendingSplitDirection("vertical") : undefined}
          onMaximize={handleMaximize}
          onClose={onClose}
        />
      )}

      {!showTerminal ? (
        <TerminalPanePlaceholder
          podStatus={podStatus}
          podError={podError}
          initProgress={initProgress}
          onClose={onClose}
          onWake={handleWake}
        />
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          <AutopilotOverlay podKey={podKey} />
          <div className="relative flex-1 min-h-0">
            {podStatus === "orphaned" && <RunnerRestartOverlay />}
            <RelayStatusOverlay
              connectionStatus={connectionStatus}
              isRunnerDisconnected={isRunnerDisconnected}
            />
            <div
              ref={terminalRef}
              className="h-full overflow-auto"
              style={{
                touchAction: "pan-y pinch-zoom",
              }}
            />
          </div>
        </div>
      )}

      <AutopilotStartButton podKey={podKey} triggerRef={triggerAutopilotRef} />
      <WorkerControlOverlay
        lease={controlLease}
        preserveHeader={showHeader}
      />

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

export default TerminalPane;
