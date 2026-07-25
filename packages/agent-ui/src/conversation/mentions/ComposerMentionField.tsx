import type { KeyboardEventHandler, RefObject } from "react";

import { MentionChips } from "./MentionChips";
import { MentionMenu } from "./MentionMenu";
import type { useComposerMentions } from "./useComposerMentions";

type Mentions = ReturnType<typeof useComposerMentions>;

export function ComposerMentionField({
  mentions,
  value,
  onChange,
  onKeyDown,
  disabled,
  ariaLabel,
  placeholder,
  textareaRef,
}: {
  mentions: Mentions;
  value: string;
  onChange: (value: string, caret: number) => void;
  onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  disabled: boolean;
  ariaLabel: string;
  placeholder: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <>
      {mentions.enabled && (
        <MentionMenu
          entries={mentions.ranked}
          onOpenDir={mentions.browser.openMentionDir}
          onSelect={mentions.browser.attachMention}
          selectedIndex={mentions.browser.mentionIndex}
        />
      )}
      <MentionChips
        disabled={disabled}
        items={mentions.browser.mentionedItems}
        onRemove={mentions.browser.removeMentionedItem}
      />
      <textarea
        aria-label={ariaLabel}
        className="min-h-24 max-h-56 w-full resize-none bg-transparent px-4 pb-2 pt-3 text-sm leading-6 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onBlur={() => mentions.browser.dismiss()}
        onChange={(event) =>
          onChange(event.target.value, event.target.selectionStart ?? 0)
        }
        onKeyDown={onKeyDown}
        onSelect={(event) =>
          onChange(
            event.currentTarget.value,
            event.currentTarget.selectionStart ?? 0,
          )
        }
        placeholder={placeholder}
        ref={textareaRef}
        rows={3}
        value={value}
      />
    </>
  );
}
