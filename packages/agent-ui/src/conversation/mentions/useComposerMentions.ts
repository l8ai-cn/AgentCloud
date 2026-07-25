import {
  useEffect,
  useState,
  type RefObject,
} from "react";

import { rankMentionEntries } from "./mentionRanking";
import { buildMentionPreamble } from "./mentionSerialize";
import { detectMentionAt, parseMentionToken } from "./mentionToken";
import { useMentionBrowser } from "./useMentionBrowser";
import type {
  WorkspaceFileEntry,
  WorkspaceFileSource,
} from "./workspaceFileSource";

export function useComposerMentions(options: {
  value: string;
  setValue: (next: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  sessionId: string;
  harness: string | null;
  workspaceFiles?: WorkspaceFileSource;
}) {
  const { value, setValue, textareaRef, sessionId, harness, workspaceFiles } =
    options;
  const enabled = workspaceFiles != null;
  const [mention, setMention] = useState<ReturnType<
    typeof detectMentionAt
  >>(null);
  const [entries, setEntries] = useState<WorkspaceFileEntry[]>([]);

  const refreshMention = (text: string, caret: number) => {
    setMention(enabled ? detectMentionAt(text, caret) : null);
  };

  const { dir, filter } = parseMentionToken(mention?.query ?? "");

  useEffect(() => {
    if (!enabled || !workspaceFiles || !mention) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    void workspaceFiles.list(sessionId, dir).then((listed) => {
      if (!cancelled) setEntries(listed);
    });
    return () => {
      cancelled = true;
    };
  }, [dir, enabled, mention, sessionId, workspaceFiles]);

  const ranked = mention ? rankMentionEntries(entries, filter) : [];

  const browser = useMentionBrowser({
    mention,
    setMention,
    mentionEntries: ranked,
    text: value,
    setText: setValue,
    textareaRef,
  });

  return {
    enabled,
    ranked,
    browser,
    refreshMention,
    composeOutboundText: (message: string) =>
      `${buildMentionPreamble(browser.mentionedItems, harness)}${message}`,
    clearMentions: () => browser.setMentionedItems([]),
  };
}
