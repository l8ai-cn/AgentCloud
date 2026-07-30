import Link from "next/link";
import { MessagesSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { SupportTicket } from "@/lib/api/admin/supportTicketTypes";
import {
  categoryOptions,
  categoryVariant,
  formatTicketTime,
  labelFor,
  priorityOptions,
  priorityVariant,
  statusOptions,
  statusVariant,
} from "./supportTicketPresentation";

interface Props {
  tickets: SupportTicket[];
  loading: boolean;
  hasFilters: boolean;
}

export function SupportTicketList({ tickets, loading, hasFilters }: Props) {
  if (loading && tickets.length === 0) {
    return (
      <div className="space-y-1 p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-md bg-surface-muted" />
        ))}
      </div>
    );
  }
  if (tickets.length === 0) {
    return (
      <EmptyState
        size="compact"
        icon={<MessagesSquare className="h-5 w-5" />}
        title="No support tickets found"
        description={
          hasFilters
            ? "Try clearing one or more filters."
            : "No users have submitted support tickets."
        }
      />
    );
  }
  return (
    <div className="divide-y divide-border">
      {tickets.map((ticket) => (
        <Link
          key={ticket.id}
          href={`/admin/support-tickets/${ticket.id}`}
          className="grid gap-3 px-4 py-3 transition-colors hover:bg-surface-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:grid-cols-[minmax(0,1fr)_9rem_8rem_8rem_11rem]"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{ticket.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              #{ticket.id} · User #{ticket.user_id}
            </p>
          </div>
          <Badge className="w-fit" variant={categoryVariant[ticket.category]}>
            {labelFor(categoryOptions, ticket.category)}
          </Badge>
          <Badge className="w-fit" variant={statusVariant[ticket.status]}>
            {labelFor(statusOptions, ticket.status)}
          </Badge>
          <Badge className="w-fit" variant={priorityVariant[ticket.priority]}>
            {labelFor(priorityOptions, ticket.priority)}
          </Badge>
          <div className="text-xs text-muted-foreground md:text-right">
            <p>{ticket.assigned_admin_id ? `Admin #${ticket.assigned_admin_id}` : "Unassigned"}</p>
            <time dateTime={ticket.updated_at}>{formatTicketTime(ticket.updated_at)}</time>
          </div>
        </Link>
      ))}
    </div>
  );
}
