import { ArrowUp, LoaderCircle, Square } from "lucide-react";
import {
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { ComposerCapabilityBar } from "./ComposerCapabilityBar";
import { ComposerConfigurationBar } from "./ComposerConfigurationBar";
import { ComposerAttachments } from "./ComposerAttachments";
import { ComposerMentionField } from "./conversation/mentions/ComposerMentionField";
import { submitComposerMessage } from "./conversation/mentions/composerSubmit";
import { useComposerMentions } from "./conversation/mentions/useComposerMentions";
import type { WorkspaceFileSource } from "./conversation/mentions/workspaceFileSource";
import { useAgentWorkspaceText } from "./AgentWorkspaceLocaleContext";
import { commandQuery, ComposerCommandMenu } from "./ComposerCommandMenu";
import type {
  AgentAttachmentReference,
  AgentSessionRuntime,
  AgentSessionSnapshot,
} from "./contracts";
import type { AgentWorkspacePresentation } from "./userWorkspacePresentation";
import { CONVERSATION_CONTENT_WIDTH } from "./conversationContentWidth";

export function ConversationComposer({
  onError,
  presentation,
  runtime,
  snapshot,
  workspaceFiles,
  mentionHarness = null,
}: {
  onError: (error: unknown) => void;
  presentation: AgentWorkspacePresentation;
  runtime: AgentSessionRuntime;
  snapshot: AgentSessionSnapshot;
  workspaceFiles?: WorkspaceFileSource;
  mentionHarness?: string | null;
}) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<AgentAttachmentReference[]>([]);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const text = useAgentWorkspaceText();
  const mentions = useComposerMentions({
    value,
    setValue,
    textareaRef,
    sessionId: snapshot.sessionId,
    harness: mentionHarness,
    workspaceFiles,
  });
  const hasActiveTool = snapshot.items.some(
    (item) =>
      item.kind === "tool" &&
      (item.status === "pending" || item.status === "running"),
  );
  const isRunning =
    snapshot.status === "running" ||
    snapshot.status === "waiting" ||
    hasActiveTool;
  const hasDraft =
    value.trim().length > 0 ||
    attachments.length > 0 ||
    mentions.browser.mentionedItems.length > 0;
  const showInterrupt = isRunning && snapshot.capabilities.interrupt;
  const canCompose = snapshot.capabilities.sendMessage && !sending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending || isRunning) return;
    setSending(true);
    try {
      const result = await submitComposerMessage({
        message: value.trim(),
        attachments,
        mentioned: mentions.browser.mentionedItems,
        outboundText: mentions.composeOutboundText(value.trim()),
        runtime,
        snapshot,
        requiresArgument: text.requiresArgument,
        slashAttachmentsUnsupported: text.slashCommandAttachmentsUnsupported,
      });
      if (result === "sent") {
        setValue("");
        setAttachments([]);
        mentions.clearMentions();
        mentions.refreshMention("", 0);
      }
    } catch (cause) {
      onError(cause);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentions.browser.handleKeyDown(event)) return;
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <form className="shrink-0 px-4 pb-3 pt-2" onSubmit={submit}>
      <div
        className={`${CONVERSATION_CONTENT_WIDTH} relative rounded-lg border border-border bg-card shadow-sm transition-colors focus-within:border-ring`}
      >
        {presentation === "developer" && (
          <ComposerCommandMenu
            commands={snapshot.commands ?? []}
            onSelect={(command) =>
              setValue(`${command.label}${command.requiresArgument ? " " : ""}`)
            }
            query={commandQuery(value)}
          />
        )}
        <ComposerMentionField
          ariaLabel={text.messageAgent}
          disabled={!canCompose}
          mentions={mentions}
          onChange={(next, caret) => {
            setValue(next);
            mentions.refreshMention(next, caret);
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            canCompose
              ? text.composerPlaceholder(snapshot.agentLabel)
              : text.readOnly
          }
          textareaRef={textareaRef}
          value={value}
        />
        <div className="flex min-h-11 items-end justify-between gap-2 px-2 pb-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <ComposerAttachments
              attachments={attachments}
              disabled={!canCompose || isRunning}
              onChange={setAttachments}
              runtime={runtime}
              sessionId={snapshot.sessionId}
            />
            {presentation === "developer" ? (
              <ComposerCapabilityBar
                onError={onError}
                runtime={runtime}
                snapshot={snapshot}
              />
            ) : (
              <div className="flex min-w-0 flex-wrap items-center gap-0.5 text-muted-foreground">
                <ComposerConfigurationBar
                  onError={onError}
                  runtime={runtime}
                  snapshot={snapshot}
                />
              </div>
            )}
          </div>
          {showInterrupt ? (
            <button
              aria-label={text.stopAgent}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() =>
                void runtime
                  .interrupt(snapshot.sessionId, crypto.randomUUID())
                  .catch(onError)
              }
              title={text.stopAgent}
              type="button"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              aria-label={text.sendMessage}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
              disabled={!hasDraft || !canCompose || isRunning}
              title={text.sendMessage}
              type="submit"
            >
              {sending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
