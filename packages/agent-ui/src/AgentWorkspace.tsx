import { useId, useMemo, useState } from "react";

import { AgentWorkspaceConversationPanel } from "./AgentWorkspaceConversationPanel";
import { AgentWorkspaceLocaleProvider } from "./AgentWorkspaceLocaleContext";
import { TerminalSurface } from "./TerminalSurface";
import type { AgentArtifactItem, AgentSessionRuntime, TerminalRuntime } from "./contracts";
import type { AgentToolRendererRegistration } from "./react/rendererTypes";
import type { AgentContentRendererRegistration } from "./react/contentRendererTypes";
import type { ContentRendererRegistry } from "./registry/ContentRendererRegistry";
import type { ToolRendererRegistry } from "./registry/ToolRendererRegistry";
import { useWorkbenchContainerMode } from "./react/useWorkbenchContainerMode";
import { useAgentSessionSnapshot } from "./useAgentSessionSnapshot";
import { useElementFullscreen } from "./useElementFullscreen";
import { WorkspaceFullscreenButton } from "./WorkspaceFullscreenButton";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { ReadOnlyAgentSessionRuntime } from "./runtime/ReadOnlyAgentSessionRuntime";
import { agentWorkspaceText, type AgentWorkspaceLocale } from "./agentWorkspaceText";
import {
  type AgentWorkspacePresentation,
  userConversationItems,
  userVisibleArtifacts,
} from "./userWorkspacePresentation";
import { userVideoExecutionSteps } from "./userVideoExecutionTrace";
import type { WorkspaceFileSource } from "./conversation/mentions/workspaceFileSource";
import { WorkspaceViewTabs, type WorkspaceView } from "./WorkspaceViewTabs";

export interface AgentWorkspaceProps {
  runtime: AgentSessionRuntime;
  terminalRuntime?: TerminalRuntime;
  sessionId: string;
  clientLabel?: string;
  className?: string;
  contentRenderers?: ContentRendererRegistry<AgentContentRendererRegistration>;
  locale?: AgentWorkspaceLocale;
  presentation?: AgentWorkspacePresentation;
  readOnly?: boolean;
  toolRenderers?: ToolRendererRegistry<AgentToolRendererRegistration>;
  workspaceArtifacts?: readonly AgentArtifactItem[];
  workspaceFiles?: WorkspaceFileSource;
  mentionHarness?: string | null;
}

export function AgentWorkspace({
  runtime,
  terminalRuntime,
  sessionId,
  clientLabel = "agent-workspace",
  className = "",
  contentRenderers,
  locale = "en-US",
  presentation = "developer",
  readOnly = false,
  toolRenderers,
  workspaceArtifacts = [],
  workspaceFiles,
  mentionHarness = null,
}: AgentWorkspaceProps) {
  const activeRuntime = useMemo(
    () => (readOnly ? new ReadOnlyAgentSessionRuntime(runtime) : runtime),
    [readOnly, runtime],
  );
  const snapshot = useAgentSessionSnapshot(activeRuntime, sessionId, runtime);
  const text = agentWorkspaceText(locale);
  const [view, setView] = useState<WorkspaceView>("conversation");
  const tabId = useId();
  const conversationTabId = `${tabId}-conversation-tab`;
  const conversationPanelId = `${tabId}-conversation-panel`;
  const terminalTabId = `${tabId}-terminal-tab`;
  const terminalPanelId = `${tabId}-terminal-panel`;
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const { containerRef, mode } = useWorkbenchContainerMode();
  const fullscreen = useElementFullscreen(containerRef);
  const terminal = snapshot.terminals[0];
  const allArtifacts = snapshot.items.filter((item) => item.kind === "artifact");
  const allConversationItems = snapshot.items.filter(
    (item) => item.kind !== "artifact",
  );
  const artifacts =
    presentation === "user"
      ? userVisibleArtifacts(allArtifacts)
      : allArtifacts;
  const conversationItems =
    presentation === "user"
      ? userConversationItems(allConversationItems)
      : allConversationItems;
  const videoExecutionSteps =
    presentation === "user"
      ? userVideoExecutionSteps(snapshot, allArtifacts)
      : [];
  const terminalEnabled =
    presentation === "developer" &&
    snapshot.capabilities.terminal &&
    terminalRuntime !== undefined &&
    terminal !== undefined;

  return (
    <AgentWorkspaceLocaleProvider locale={locale}>
      <div
        className={`flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground ${className}`}
        data-agent-workspace={sessionId}
        ref={containerRef}
      >
        <WorkspaceHeader
          actions={
            <WorkspaceFullscreenButton
              active={fullscreen.active}
              onToggle={fullscreen.toggle}
              supported={fullscreen.supported}
            />
          }
          presentation={presentation}
          snapshot={snapshot}
          tabs={
            <WorkspaceViewTabs
              conversationPanelId={conversationPanelId}
              conversationTabId={conversationTabId}
              onViewChange={setView}
              terminalEnabled={terminalEnabled}
              terminalPanelId={terminalPanelId}
              terminalTabId={terminalTabId}
              view={view}
            />
          }
        />
        {(surfaceError ||
          (presentation === "developer" && snapshot.error)) && (
          <div className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {presentation === "user"
              ? text.taskFailed
              : snapshot.error || surfaceError}
          </div>
        )}
        {view === "terminal" && terminalEnabled ? (
          <section
            aria-labelledby={terminalTabId}
            className="flex min-h-0 flex-1"
            id={terminalPanelId}
            role="tabpanel"
          >
            <TerminalSurface
              clientLabel={clientLabel}
              resource={terminal}
              runtime={terminalRuntime}
            />
          </section>
        ) : (
          <section
            aria-labelledby={conversationTabId}
            className="flex min-h-0 flex-1 flex-col"
            id={conversationPanelId}
            role="tabpanel"
          >
            <AgentWorkspaceConversationPanel
              allArtifacts={allArtifacts}
              artifacts={artifacts}
              contentRenderers={contentRenderers}
              conversationItems={conversationItems}
              mentionHarness={mentionHarness}
              mode={mode}
              onError={setSurfaceError}
              plan={snapshot.plan}
              presentation={presentation}
              runtime={activeRuntime}
              sessionId={sessionId}
              snapshot={snapshot}
              toolRenderers={toolRenderers}
              videoExecutionSteps={videoExecutionSteps}
              workspaceArtifacts={workspaceArtifacts}
              workspaceFiles={workspaceFiles}
            />
          </section>
        )}
      </div>
    </AgentWorkspaceLocaleProvider>
  );
}
