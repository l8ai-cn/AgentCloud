import { useTranslations } from "next-intl";
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
  categoryLabelKeys,
  categoryVariant,
  formatTicketTime,
  priorityLabelKeys,
  priorityVariant,
  statusLabelKeys,
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
  const t = useTranslations("admin");
  return (
    <section className="rounded-md border border-border bg-surface-raised">
      <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-5">
        <Meta label={t("support.fields.status")}>
          <Select
            value={ticket.status}
            onValueChange={(value) => onRequestStatus(value as SupportTicketStatus)}
            disabled={busy}
          >
            <SelectTrigger
              className="h-8 w-full"
              aria-label={t("support.changeStatusAriaLabel")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ticket.status}>
                {t(statusLabelKeys[ticket.status])}
              </SelectItem>
              {statusTransitions[ticket.status].map((status) => (
                <SelectItem key={status} value={status}>
                  {t(statusLabelKeys[status])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Meta>
        <Meta label={t("support.fields.category")}>
          <Badge variant={categoryVariant[ticket.category]}>
            {t(categoryLabelKeys[ticket.category])}
          </Badge>
        </Meta>
        <Meta label={t("support.fields.priority")}>
          <Badge variant={priorityVariant[ticket.priority]}>
            {t(priorityLabelKeys[ticket.priority])}
          </Badge>
        </Meta>
        <Meta label={t("support.fields.assignment")}>
          {ticket.assigned_admin_id ? (
            <span className="text-sm">
              {t("support.adminRef", { id: String(ticket.assigned_admin_id) })}
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onRequestAssign}
              disabled={busy}
            >
              <UserCheck className="mr-2 h-4 w-4" />
              {t("support.assignToMe")}
            </Button>
          )}
        </Meta>
        <Meta label={t("support.fields.updated")}>
          <time className="text-sm" dateTime={ticket.updated_at}>
            {formatTicketTime(ticket.updated_at)}
          </time>
        </Meta>
      </div>
      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <Badge variant={statusVariant[ticket.status]} className="mr-2">
          {t(statusLabelKeys[ticket.status])}
        </Badge>
        {t("support.createdAt", { time: formatTicketTime(ticket.created_at) })}
        {ticket.resolved_at &&
          ` · ${t("support.resolvedAt", { time: formatTicketTime(ticket.resolved_at) })}`}
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
