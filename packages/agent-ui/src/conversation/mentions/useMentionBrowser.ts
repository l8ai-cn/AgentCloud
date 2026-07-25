import {
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
} from "react";

import type { WorkspaceFileEntry } from "./workspaceFileSource";
import {
  mentionItemKey,
  type MentionItem,
} from "./mentionSerialize";
import type { MentionState } from "./mentionToken";

export interface MentionBrowserParams {
  mention: MentionState | null;
  setMention: (next: MentionState | null) => void;
  mentionEntries: readonly WorkspaceFileEntry[];
  text: string;
  setText: (next: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  isMobile?: boolean;
}

export interface MentionBrowser {
  mentionIndex: number;
  mentionOpen: boolean;
  mentionedItems: MentionItem[];
  setMentionedItems: Dispatch<SetStateAction<MentionItem[]>>;
  attachMention: (path: string, isDir: boolean) => void;
  openMentionDir: (path: string) => void;
  removeMentionedItem: (index: number) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  dismiss: () => void;
}

export function useMentionBrowser(params: MentionBrowserParams): MentionBrowser {
  const {
    mention,
    setMention,
    mentionEntries,
    text,
    setText,
    textareaRef,
    isMobile = false,
  } = params;
  const [mentionIndex, setMentionIndex] = useState(-1);
  const [mentionedItems, setMentionedItems] = useState<MentionItem[]>([]);
  const mentionOpen = mentionEntries.length > 0;

  const prevKeys = useRef<string[]>([]);
  const entryKeys = mentionEntries.map((e) => `${e.type}:${e.path}`);
  if (
    entryKeys.length !== prevKeys.current.length ||
    entryKeys.some((k, i) => k !== prevKeys.current[i])
  ) {
    prevKeys.current = entryKeys;
    setMentionIndex(entryKeys.length > 0 ? 0 : -1);
  }

  const attachMention = (path: string, isDir: boolean) => {
    if (!mention) return;
    setText(text.slice(0, mention.start) + text.slice(mention.end));
    const item: MentionItem = { path, isDir };
    const key = mentionItemKey(item);
    setMentionedItems((prev) =>
      prev.some((it) => mentionItemKey(it) === key) ? prev : [...prev, item],
    );
    setMention(null);
    setMentionIndex(-1);
    queueMicrotask(() => {
      const ta = textareaRef.current;
      if (ta) ta.setSelectionRange(mention.start, mention.start);
      ta?.focus();
    });
  };

  const openMentionDir = (path: string) => {
    if (!mention) return;
    const inserted = `@${path}/`;
    const next = text.slice(0, mention.start) + inserted + text.slice(mention.end);
    setText(next);
    const caret = mention.start + inserted.length;
    setMention({ query: `${path}/`, start: mention.start, end: caret });
    setMentionIndex(0);
    queueMicrotask(() => {
      const ta = textareaRef.current;
      if (ta) ta.setSelectionRange(caret, caret);
      ta?.focus();
    });
  };

  const removeMentionedItem = (index: number) =>
    setMentionedItems((prev) => prev.filter((_, i) => i !== index));

  const dismiss = () => {
    if (!mention) return;
    setMention(null);
    setMentionIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!mentionOpen) return false;
    const active = mentionIndex >= 0 ? mentionEntries[mentionIndex] : undefined;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % mentionEntries.length);
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((i) => (i <= 0 ? mentionEntries.length - 1 : i - 1));
      return true;
    }
    if (e.key === "Enter" && !e.shiftKey && !isMobile && active) {
      e.preventDefault();
      if (active.type === "directory") openMentionDir(active.path);
      else attachMention(active.path, false);
      return true;
    }
    if (e.key === "Tab" && active) {
      e.preventDefault();
      attachMention(active.path, active.type === "directory");
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      dismiss();
      return true;
    }
    return false;
  };

  return {
    mentionIndex,
    mentionOpen,
    mentionedItems,
    setMentionedItems,
    attachMention,
    openMentionDir,
    removeMentionedItem,
    handleKeyDown,
    dismiss,
  };
}
