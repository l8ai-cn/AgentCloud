import Link from "next/link";
import { useTranslations } from "next-intl";
import { MessagesSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { SupportTicket } from "@/lib/api/admin/supportTicketTypes";
import {
  categoryLabelKeys,
  categoryVariant,
  formatTicketTime,
  priorityLabelKeys,
  priorityVariant,
  statusLabelKeys,
  statusVariant,
} from "./supportTicketPresentation";

interface Props {
  tickets: SupportTicket[];
  loading: boolean;
  hasFilters: boolean;
}

export function SupportTicketList({ tickets, loading, hasFilters }: Props) {
  const t = useTranslations("admin");
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
        title={t("support.emptyTitle")}
        description={
          hasFilters
            ? t("support.emptyFiltered")
            : t("support.emptyDescription")
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
              {t("support.ticketMeta", {
                id: String(ticket.id),
                userId: String(ticket.user_id),
              })}
            </p>
          </div>
          <Badge className="w-fit" variant={categoryVariant[ticket.category]}>
            {t(categoryLabelKeys[ticket.category])}
          </Badge>
          <Badge className="w-fit" variant={statusVariant[ticket.status]}>
            {t(statusLabelKeys[ticket.status])}
          </Badge>
          <Badge className="w-fit" variant={priorityVariant[ticket.priority]}>
            {t(priorityLabelKeys[ticket.priority])}
          </Badge>
          <div className="text-xs text-muted-foreground md:text-right">
            <p>
              {ticket.assigned_admin_id
                ? t("support.adminRef", { id: String(ticket.assigned_admin_id) })
                : t("support.unassigned")}
            </p>
            <time dateTime={ticket.updated_at}>{formatTicketTime(ticket.updated_at)}</time>
          </div>
        </Link>
      ))}
    </div>
  );
}
