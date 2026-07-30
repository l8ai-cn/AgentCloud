import type { BadgeProps } from "@/components/ui/badge";
import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/lib/api/admin/supportTicketTypes";

export const statusOptions: Array<{ value: SupportTicketStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export const categoryOptions: Array<{
  value: SupportTicketCategory;
  label: string;
}> = [
  { value: "bug", label: "Bug" },
  { value: "feature_request", label: "Feature request" },
  { value: "usage_question", label: "Usage question" },
  { value: "account", label: "Account" },
  { value: "other", label: "Other" },
];

export const priorityOptions: Array<{
  value: SupportTicketPriority;
  label: string;
}> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

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

export function labelFor<T extends string>(
  options: Array<{ value: T; label: string }>,
  value: T,
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function formatTicketTime(value: string): string {
  return new Date(value).toLocaleString();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
