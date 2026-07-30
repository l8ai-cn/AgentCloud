"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useState } from "react";

import { AlertMessage } from "@/components/ui/alert-message";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import type { SupportTicketStatus } from "@/lib/api/admin/supportTicketTypes";
import { getErrorMessage } from "@/lib/utils";
import { TicketConversation } from "./TicketConversation";
import { TicketMetaPanel } from "./TicketMetaPanel";
import { TicketReplyForm } from "./TicketReplyForm";
import { useSupportTicketDetail } from "./useSupportTicketDetail";
import { labelFor, statusOptions } from "../supportTicketPresentation";

type PendingAction =
  | { type: "status"; status: SupportTicketStatus }
  | { type: "assign" }
  | null;

export default function SupportTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const parsedId = Number(params.id);
  const ticketId = Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : null;
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState<PendingAction>(null);
  const detail = useSupportTicketDetail(ticketId);
  const ticket = detail.data?.ticket;
  const messages = detail.data?.messages ?? [];
  const busy = detail.action !== null;

  if (ticketId === null) {
    return <AlertMessage type="error" message="The support ticket ID is invalid." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        className="-mx-4 -mt-4 px-4 md:-mx-6 md:-mt-6 md:px-6"
        title={ticket?.title ?? "Support ticket"}
        subtitle={ticket ? `Ticket #${ticket.id} · User #${ticket.user_id}` : "Loading ticket details"}
        breadcrumb={
          <Link href="/admin/support-tickets" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Support tickets
          </Link>
        }
        actions={
          <Button variant="outline" size="sm" onClick={detail.reload} loading={detail.loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {detail.error && <AlertMessage type="error" message={detail.error} />}
      {detail.loading && !detail.data ? (
        <div className="space-y-3">
          <div className="h-28 animate-pulse rounded-md bg-surface-muted" />
          <div className="h-80 animate-pulse rounded-md bg-surface-muted" />
        </div>
      ) : ticket ? (
        <>
          <TicketMetaPanel
            ticket={ticket}
            busy={busy}
            onRequestStatus={(status) => setPending({ type: "status", status })}
            onRequestAssign={() => setPending({ type: "assign" })}
          />
          <section className="overflow-hidden rounded-md border border-border bg-surface-raised">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Conversation</h2>
            </div>
            <TicketConversation
              messages={messages}
              downloading={detail.action === "download"}
              onDownload={detail.downloadAttachment}
            />
            <TicketReplyForm
              content={reply}
              sending={detail.action === "reply"}
              disabled={busy}
              onChange={setReply}
              onSubmit={async () => {
                try {
                  await detail.reply(reply.trim());
                  setReply("");
                } catch (error) {
                  getErrorMessage(error, "Failed to send reply.");
                }
              }}
            />
          </section>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Ticket details are unavailable.</p>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.type === "assign" ? "Assign this ticket to you?" : "Change ticket status?"}
        description={
          pending?.type === "status"
            ? `Move this ticket to ${labelFor(statusOptions, pending.status)}?`
            : "You will become the assigned system administrator."
        }
        variant={pending?.type === "status" && pending.status === "closed" ? "warning" : "default"}
        confirmText={pending?.type === "assign" ? "Assign to me" : "Change status"}
        loading={detail.action === "status" || detail.action === "assign"}
        onConfirm={async () => {
          if (pending?.type === "status") await detail.changeStatus(pending.status);
          if (pending?.type === "assign") await detail.assignToMe();
          setPending(null);
        }}
      />
    </div>
  );
}
