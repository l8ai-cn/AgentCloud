import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleDashed,
  CircleDot,
  Minus,
  Timer,
  type LucideIcon,
} from "lucide-react";
import type { TicketPriority, TicketStatus } from "@/lib/viewModels/ticket";

export interface TicketStatusDisplay {
  label: string;
  color: string;
  bgColor: string;
  icon: LucideIcon;
}

export interface TicketPriorityDisplay {
  label: string;
  color: string;
  icon: LucideIcon;
}

export const TICKET_STATUS_ORDER: TicketStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
];

export const TICKET_PRIORITY_ORDER: TicketPriority[] = [
  "none",
  "low",
  "medium",
  "high",
  "urgent",
];

const STATUS_DISPLAY: Record<TicketStatus, TicketStatusDisplay> = {
  backlog: {
    label: "Backlog",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    icon: CircleDashed,
  },
  todo: {
    label: "To Do",
    color: "text-info",
    bgColor: "bg-info-bg",
    icon: Circle,
  },
  in_progress: {
    label: "In Progress",
    color: "text-warning",
    bgColor: "bg-warning-bg",
    icon: Timer,
  },
  in_review: {
    label: "In Review",
    color: "text-primary",
    bgColor: "bg-accent",
    icon: CircleDot,
  },
  done: {
    label: "Done",
    color: "text-success",
    bgColor: "bg-success-bg",
    icon: CheckCircle2,
  },
};

const UNKNOWN_STATUS_DISPLAY: TicketStatusDisplay = {
  label: "Unknown",
  color: "text-muted-foreground",
  bgColor: "bg-muted",
  icon: CircleDashed,
};

const PRIORITY_DISPLAY: Record<TicketPriority, TicketPriorityDisplay> = {
  none: { label: "None", color: "text-muted-foreground", icon: Minus },
  low: { label: "Low", color: "text-info", icon: ChevronDown },
  medium: { label: "Medium", color: "text-warning", icon: Minus },
  high: { label: "High", color: "text-primary", icon: ChevronUp },
  urgent: { label: "Urgent", color: "text-danger", icon: AlertTriangle },
};

const UNKNOWN_PRIORITY_DISPLAY: TicketPriorityDisplay = {
  label: "Unknown",
  color: "text-muted-foreground",
  icon: Minus,
};

export function getTicketStatusDisplay(
  status: string,
): TicketStatusDisplay {
  return STATUS_DISPLAY[status as TicketStatus] ?? UNKNOWN_STATUS_DISPLAY;
}

export function getTicketPriorityDisplay(
  priority: string,
): TicketPriorityDisplay {
  return PRIORITY_DISPLAY[priority as TicketPriority] ?? UNKNOWN_PRIORITY_DISPLAY;
}
