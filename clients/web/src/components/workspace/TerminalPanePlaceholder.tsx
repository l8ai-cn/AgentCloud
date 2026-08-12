"use client";

import { isPodResumableSource } from "@/lib/pod-status";
import {
  PaneErrorState,
  PaneLoadingState,
  PaneReconnectingState,
  type InitProgress,
} from "./PaneStateViews";

interface TerminalPanePlaceholderProps {
  podStatus: string;
  podError: string | null;
  initProgress?: InitProgress;
  onClose?: () => void;
  onWake: () => void;
}

// Shown until the PTY is live. Every branch offers wake on exactly the statuses
// the backend accepts as a resume source, so the affordance can't drift per view.
export function TerminalPanePlaceholder({
  podStatus,
  podError,
  initProgress,
  onClose,
  onWake,
}: TerminalPanePlaceholderProps) {
  const wake = isPodResumableSource(podStatus) ? onWake : undefined;

  if (podError) {
    return <PaneErrorState error={podError} onClose={onClose} onWake={wake} />;
  }
  if (podStatus === "orphaned") {
    return <PaneReconnectingState onClose={onClose} onWake={wake} />;
  }
  return (
    <PaneLoadingState
      podStatus={podStatus}
      initProgress={initProgress}
      onClose={onClose}
      onWake={wake}
    />
  );
}
