import { Loader2 } from "lucide-react";
import { type ReactNode } from "react";

import { ActivityTimeline } from "./ActivityTimeline";
import { ApprovalDock } from "./ApprovalDock";
import { ConversationComposer } from "./ConversationComposer";
import { ConversationEmptyState } from "./ConversationEmptyState";
import { JumpToLatest } from "./conversation/history/JumpToLatest";
import { useConversationHistoryScroll } from "./conversation/history/useConversationHistoryScroll";
import { useAgentWorkspaceText } from "./AgentWorkspaceLocaleContext";
import type {
  AgentSessionRuntime,
  AgentSessionSnapshot,
  AgentTimelineItem,
} from "./contracts";
import type { ContentRendererRegistry } from "./registry/ContentRendererRegistry";
import type { ToolRendererRegistry } from "./registry/ToolRendererRegistry";
import type { AgentContentRendererRegistration } from "./react/contentRendererTypes";
import type { AgentToolRendererRegistration } from "./react/rendererTypes";
import type { WorkspaceFileSource } from "./conversation/mentions/workspaceFileSource";
import type { AgentWorkspacePresentation } from "./userWorkspacePresentation";

export interface AgentConversationSurfaceProps {
  contentRenderers?: ContentRendererRegistry<AgentContentRendererRegistration>;
  executionTrace?: ReactNode;
  items: AgentTimelineItem[];
  onError: (cause: unknown) => void;
  presentation: AgentWorkspacePresentation;
  runtime: AgentSessionRuntime;
  snapshot: AgentSessionSnapshot;
  toolRenderers?: ToolRendererRegistry<AgentToolRendererRegistration>;
  workspaceFiles?: WorkspaceFileSource;
  mentionHarness?: string | null;
}

export function AgentConversationSurface({
  contentRenderers,
  executionTrace,
  items,
  onError,
  presentation,
  runtime,
  snapshot,
  toolRenderers,
  workspaceFiles,
  mentionHarness = null,
}: AgentConversationSurfaceProps) {
  const text = useAgentWorkspaceText();
  const isEmpty =
    !executionTrace && items.length === 0 && snapshot.permissions.length === 0;
  const { loadingOlder, scrollRef, showJump, jumpToLatest } =
    useConversationHistoryScroll({
      hasOlderItems: snapshot.hasOlderItems,
      itemCount: items.length,
      loadOlder: () =>
        runtime.loadOlder(snapshot.sessionId).catch((cause) => {
          onError(cause);
        }),
      sessionId: snapshot.sessionId,
    });

  if (isEmpty) {
    return (
      <main className="flex h-full min-h-0 flex-col justify-center gap-5 overflow-y-auto py-6">
        <ConversationEmptyState agentLabel={snapshot.agentLabel} />
        <ConversationComposer
          mentionHarness={mentionHarness}
          onError={onError}
          presentation={presentation}
          runtime={runtime}
          snapshot={snapshot}
          workspaceFiles={workspaceFiles}
        />
      </main>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {executionTrace}
      <div className="relative min-h-0 flex-1">
        <main className="h-full overflow-y-auto" ref={scrollRef}>
          {loadingOlder && (
            <div className="flex justify-center px-3 pt-3 text-muted-foreground">
              <Loader2
                aria-label={text.loadEarlierActivity}
                className="size-3.5 animate-spin"
              />
            </div>
          )}
          <ActivityTimeline
            contentRenderers={contentRenderers}
            items={items}
            runtime={runtime}
            sessionId={snapshot.sessionId}
            toolRenderers={toolRenderers}
          />
        </main>
        <JumpToLatest
          label={text.jumpToLatest}
          onClick={jumpToLatest}
          visible={showJump}
        />
      </div>
      <ApprovalDock
        disabled={!snapshot.capabilities.resolvePermission}
        onError={onError}
        permissions={snapshot.permissions}
        runtime={runtime}
        sessionId={snapshot.sessionId}
      />
      <ConversationComposer
        mentionHarness={mentionHarness}
        onError={onError}
        presentation={presentation}
        runtime={runtime}
        snapshot={snapshot}
        workspaceFiles={workspaceFiles}
      />
    </div>
  );
}
