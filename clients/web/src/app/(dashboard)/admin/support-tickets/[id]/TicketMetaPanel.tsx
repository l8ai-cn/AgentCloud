import { UserCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  SupportTicket,
  SupportTicketStatus,
} from "@/lib/api/admin/supportTicketTypes";
import {
  categoryOptions,
  categoryVariant,
  formatTicketTime,
  labelFor,
  priorityOptions,
  priorityVariant,
  statusOptions,
  statusTransitions,
  statusVariant,
} from "../supportTicketPresentation";

interface Props {
  ticket: SupportTicket;
  busy: boolean;
  onRequestStatus: (status: SupportTicketStatus) => void;
  onRequestAssign: () => void;
}

export function TicketMetaPanel({
  ticket,
  busy,
  onRequestStatus,
  onRequestAssign,
}: Props) {
  return (
    <section className="rounded-md border border-border bg-surface-raised">
      <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-5">
        <Meta label="Status">
          <Select
            value={ticket.status}
            onValueChange={(value) => onRequestStatus(value as SupportTicketStatus)}
            disabled={busy}
          >
            <SelectTrigger className="h-8 w-full" aria-label="Change ticket status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ticket.status}>
                {labelFor(statusOptions, ticket.status)}
              </SelectItem>
              {statusTransitions[ticket.status].map((status) => (
                <SelectItem key={status} value={status}>
                  {labelFor(statusOptions, status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Meta>
        <Meta label="Category">
          <Badge variant={categoryVariant[ticket.category]}>
            {labelFor(categoryOptions, ticket.category)}
          </Badge>
        </Meta>
        <Meta label="Priority">
          <Badge variant={priorityVariant[ticket.priority]}>
            {labelFor(priorityOptions, ticket.priority)}
          </Badge>
        </Meta>
        <Meta label="Assignment">
          {ticket.assigned_admin_id ? (
            <span className="text-sm">Admin #{ticket.assigned_admin_id}</span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onRequestAssign}
              disabled={busy}
            >
              <UserCheck className="mr-2 h-4 w-4" />
              Assign to me
            </Button>
          )}
        </Meta>
        <Meta label="Updated">
          <time className="text-sm" dateTime={ticket.updated_at}>
            {formatTicketTime(ticket.updated_at)}
          </time>
        </Meta>
      </div>
      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <Badge variant={statusVariant[ticket.status]} className="mr-2">
          {labelFor(statusOptions, ticket.status)}
        </Badge>
        Created {formatTicketTime(ticket.created_at)}
        {ticket.resolved_at && ` · Resolved ${formatTicketTime(ticket.resolved_at)}`}
      </div>
    </section>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
