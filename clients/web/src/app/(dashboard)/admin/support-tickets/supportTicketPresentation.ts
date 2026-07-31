import type { BadgeProps } from "@/components/ui/badge";
import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/lib/api/admin/supportTicketTypes";

export const statusValues: SupportTicketStatus[] = [
  "open",
  "in_progress",
  "resolved",
  "closed",
];

export const categoryValues: SupportTicketCategory[] = [
  "bug",
  "feature_request",
  "usage_question",
  "account",
  "other",
];

export const priorityValues: SupportTicketPriority[] = ["low", "medium", "high"];

export const statusLabelKeys: Record<SupportTicketStatus, string> = {
  open: "support.status.open",
  in_progress: "support.status.inProgress",
  resolved: "support.status.resolved",
  closed: "support.status.closed",
};

export const categoryLabelKeys: Record<SupportTicketCategory, string> = {
  bug: "support.category.bug",
  feature_request: "support.category.featureRequest",
  usage_question: "support.category.usageQuestion",
  account: "support.category.account",
  other: "support.category.other",
};

export const priorityLabelKeys: Record<SupportTicketPriority, string> = {
  low: "support.priority.low",
  medium: "support.priority.medium",
  high: "support.priority.high",
};

export const statusTransitions: Record<
  SupportTicketStatus,
  SupportTicketStatus[]
> = {
  open: ["in_progress", "resolved", "closed"],
  in_progress: ["open", "resolved", "closed"],
  resolved: ["open", "closed"],
  closed: ["open"],
};

export const statusVariant: Record<
  SupportTicketStatus,
  BadgeProps["variant"]
> = {
  open: "destructive",
  in_progress: "warning",
  resolved: "success",
  closed: "secondary",
};

export const categoryVariant: Record<
  SupportTicketCategory,
  BadgeProps["variant"]
> = {
  bug: "destructive",
  feature_request: "default",
  usage_question: "info",
  account: "outline",
  other: "secondary",
};

export const priorityVariant: Record<
  SupportTicketPriority,
  BadgeProps["variant"]
> = {
  low: "secondary",
  medium: "warning",
  high: "destructive",
};

export function formatTicketTime(value: string): string {
  return new Date(value).toLocaleString();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
