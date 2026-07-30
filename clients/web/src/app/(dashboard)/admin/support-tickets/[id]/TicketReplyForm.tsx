import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  content: string;
  sending: boolean;
  disabled: boolean;
  onChange: (content: string) => void;
  onSubmit: () => void;
}

export function TicketReplyForm({
  content,
  sending,
  disabled,
  onChange,
  onSubmit,
}: Props) {
  const canSubmit = content.trim().length > 0 && !disabled && !sending;
  return (
    <div className="border-t border-border p-4">
      <Textarea
        value={content}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Write an admin reply"
        aria-label="Admin reply"
        rows={4}
        disabled={disabled || sending}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && canSubmit) {
            event.preventDefault();
            onSubmit();
          }
        }}
      />
      <div className="mt-3 flex justify-end">
        <Button size="sm" onClick={onSubmit} disabled={!canSubmit} loading={sending}>
          <Send className="mr-2 h-4 w-4" />
          Send reply
        </Button>
      </div>
    </div>
  );
}
