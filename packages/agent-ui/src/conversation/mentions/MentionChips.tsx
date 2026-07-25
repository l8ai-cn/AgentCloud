import { X } from "lucide-react";

import { mentionItemPath, type MentionItem } from "./mentionSerialize";

export function MentionChips({
  items,
  disabled,
  onRemove,
}: {
  items: readonly MentionItem[];
  disabled?: boolean;
  onRemove: (index: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 px-4 pb-1">
      {items.map((item, index) => (
        <span
          className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs"
          key={`${item.path}:${item.isDir}:${index}`}
        >
          <span className="truncate">{mentionItemPath(item)}</span>
          <button
            aria-label={`Remove ${mentionItemPath(item)}`}
            className="shrink-0 opacity-60 hover:opacity-100 disabled:opacity-30"
            disabled={disabled}
            onClick={() => onRemove(index)}
            type="button"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
