import {
  CheckCircle2,
  CircleHelp,
  Hourglass,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Square,
  WifiOff,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import type { PodStatus } from "@/lib/pod-status";

export interface PodStatusDisplay {
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
  icon: LucideIcon;
  spin?: boolean;
}

const UNKNOWN_POD_STATUS: PodStatusDisplay = {
  label: "Unknown",
  color: "text-muted-foreground",
  bgColor: "bg-muted",
  dotColor: "bg-muted-foreground",
  icon: CircleHelp,
};

// Keyed by PodStatus so a new status fails typecheck here instead of silently
// rendering as Unknown.
const POD_STATUS_DISPLAY: Record<PodStatus, PodStatusDisplay> = {
  queued: {
    label: "Queued",
    color: "text-warning",
    bgColor: "bg-warning-bg",
    dotColor: "bg-warning",
    icon: Hourglass,
  },
  initializing: {
    label: "Initializing",
    color: "text-info",
    bgColor: "bg-info-bg",
    dotColor: "bg-info",
    icon: Loader2,
    spin: true,
  },
  running: {
    label: "Running",
    color: "text-success",
    bgColor: "bg-success-bg",
    dotColor: "bg-success",
    icon: Play,
  },
  paused: {
    label: "Paused",
    color: "text-warning",
    bgColor: "bg-warning-bg",
    dotColor: "bg-warning",
    icon: Pause,
  },
  disconnected: {
    label: "Disconnected",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    dotColor: "bg-muted-foreground",
    icon: WifiOff,
  },
  orphaned: {
    label: "Orphaned",
    color: "text-warning",
    bgColor: "bg-warning-bg",
    dotColor: "bg-warning",
    icon: RefreshCw,
    spin: true,
  },
  completed: {
    label: "Completed",
    color: "text-success",
    bgColor: "bg-success-bg",
    dotColor: "bg-success",
    icon: CheckCircle2,
  },
  terminated: {
    label: "Terminated",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    dotColor: "bg-muted-foreground",
    icon: Square,
  },
  error: {
    label: "Error",
    color: "text-danger",
    bgColor: "bg-danger-bg",
    dotColor: "bg-danger",
    icon: XCircle,
  },
};

export function getPodStatusDisplay(status: string): PodStatusDisplay {
  return POD_STATUS_DISPLAY[status as PodStatus] ?? UNKNOWN_POD_STATUS;
}
