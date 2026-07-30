import { Download, MessageSquare, Shield, UserCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { SupportTicketMessage } from "@/lib/api/admin/supportTicketTypes";
import {
  formatFileSize,
  formatTicketTime,
} from "../supportTicketPresentation";

interface Props {
  messages: SupportTicketMessage[];
  downloading: boolean;
  onDownload: (id: number, name: string) => void;
}

export function TicketConversation({ messages, downloading, onDownload }: Props) {
  if (messages.length === 0) {
    return (
      <EmptyState
        size="compact"
        icon={<MessageSquare className="h-5 w-5" />}
        title="No messages"
        description="This ticket does not contain any conversation messages."
      />
    );
  }
  return (
    <div className="space-y-5 p-4">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          downloading={downloading}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
}

function MessageBubble({
  message,
  downloading,
  onDownload,
}: {
  message: SupportTicketMessage;
  downloading: boolean;
  onDownload: (id: number, name: string) => void;
}) {
  const isAdmin = message.is_admin_reply;
  const Icon = isAdmin ? Shield : UserCircle;
  return (
    <article className={`flex gap-3 ${isAdmin ? "flex-row-reverse" : ""}`}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={`min-w-0 max-w-[85%] ${isAdmin ? "text-right" : ""}`}>
        <div className={`mb-1 flex flex-wrap items-center gap-2 text-xs ${isAdmin ? "justify-end" : ""}`}>
          <span className="font-medium">
            {message.user?.name || message.user?.email || `User #${message.user_id}`}
          </span>
          {isAdmin && <Badge variant="outline">Admin</Badge>}
          <time className="text-muted-foreground" dateTime={message.created_at}>
            {formatTicketTime(message.created_at)}
          </time>
        </div>
        <div className={`rounded-md px-3 py-2 text-left text-sm ${isAdmin ? "bg-primary/10" : "bg-surface-muted"}`}>
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        {message.attachments.length > 0 && (
          <div className={`mt-2 flex flex-wrap gap-2 ${isAdmin ? "justify-end" : ""}`}>
            {message.attachments.map((attachment) => (
              <Button
                key={attachment.id}
                variant="outline"
                size="sm"
                disabled={downloading}
                onClick={() => onDownload(attachment.id, attachment.original_name)}
                title={`${attachment.mime_type} · ${formatFileSize(attachment.size)}`}
              >
                <Download className="mr-2 h-4 w-4" />
                <span className="max-w-48 truncate">{attachment.original_name}</span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
