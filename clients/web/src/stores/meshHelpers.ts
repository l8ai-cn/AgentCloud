import { Play, Hourglass, Pause, type LucideIcon } from "lucide-react";
import { getPodStatusDisplay } from "@/lib/pod-status-display";

export const getPodStatusInfo = getPodStatusDisplay;

export const getAgentStatusInfo = (agentStatus: string): {
  label: string; color: string; dotColor: string; bgColor: string; icon: LucideIcon;
} => {
  const statusMap: Record<string, {
    label: string; color: string; dotColor: string; bgColor: string; icon: LucideIcon;
  }> = {
    executing: {
      label: "Executing", color: "text-success",
      dotColor: "bg-success", bgColor: "bg-success-bg", icon: Play,
    },
    waiting: {
      label: "Waiting for Input", color: "text-warning",
      dotColor: "bg-warning", bgColor: "bg-warning-bg", icon: Hourglass,
    },
    idle: {
      label: "Idle", color: "text-muted-foreground",
      dotColor: "bg-muted-foreground", bgColor: "bg-muted", icon: Pause,
    },
  };
  return statusMap[agentStatus] || {
    label: "Unknown",
    color: "text-muted-foreground",
    dotColor: "bg-muted-foreground",
    bgColor: "bg-muted",
    icon: Pause,
  };
};

export const getBindingStatusInfo = (status: string) => {
  const statusMap: Record<string, { label: string; color: string }> = {
    active: { label: "Active", color: "stroke-success" },
    pending: { label: "Pending", color: "stroke-warning" },
    revoked: { label: "Revoked", color: "stroke-danger" },
    expired: { label: "Expired", color: "stroke-muted-foreground" },
  };
  return statusMap[status] || {
    label: "Unknown",
    color: "stroke-muted-foreground",
  };
};
