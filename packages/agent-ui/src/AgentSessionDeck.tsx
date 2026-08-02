import { Plus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { AgentWorkspace, type AgentWorkspaceProps } from "./AgentWorkspace";
import {
  AgentSessionDeckTab,
  type AgentSessionDeckEntry,
} from "./AgentSessionDeckTab";
import { AgentWorkspaceLocaleProvider } from "./AgentWorkspaceLocaleContext";
import { focusAdjacentTab } from "./react/tabKeyboardNavigation";
import { useAgentWorkspaceText } from "./AgentWorkspaceLocaleContext";
import { useElementFullscreen } from "./useElementFullscreen";
import { WorkspaceFullscreenButton } from "./WorkspaceFullscreenButton";

export interface AgentSessionDeckProps
  extends Omit<
    AgentWorkspaceProps,
    "runtime" | "sessionId" | "showFullscreen" | "terminalRuntime"
  > {
  activeSessionId?: string;
  defaultActiveSessionId?: string;
  onActiveSessionChange?: (sessionId: string) => void;
  onCloseSession?: (sessionId: string) => void;
  onCreateSession?: () => void;
  sessions: readonly AgentSessionDeckEntry[];
}

export type { AgentSessionDeckEntry };

export function AgentSessionDeck({
  activeSessionId,
  className = "",
  defaultActiveSessionId,
  locale = "en-US",
  onActiveSessionChange,
  onCloseSession,
  onCreateSession,
  sessions,
  ...workspaceProps
}: AgentSessionDeckProps) {
  const baseId = useId();
  const [innerActive, setInnerActive] = useState(defaultActiveSessionId);
  const requested = activeSessionId ?? innerActive;
  const resolvedActive = sessions.some((s) => s.sessionId === requested)
    ? requested
    : sessions[0]?.sessionId;
  // 已访问会话保持挂载，避免终端/滚动状态在切换时丢失；未访问的不建立连接
  const [visited, setVisited] = useState<readonly string[]>(() =>
    resolvedActive ? [resolvedActive] : [],
  );
  useEffect(() => {
    if (resolvedActive && !visited.includes(resolvedActive)) {
      setVisited((current) => [...current, resolvedActive]);
    }
  }, [resolvedActive, visited]);
  const mounted = sessions.filter((s) => visited.includes(s.sessionId));
  const activate = (sessionId: string) => {
    setInnerActive(sessionId);
    onActiveSessionChange?.(sessionId);
  };
  const deckRef = useRef<HTMLDivElement>(null);
  const fullscreen = useElementFullscreen(deckRef);

  return (
    <AgentWorkspaceLocaleProvider locale={locale}>
      <div
        className={`group/agentws flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground ${
          fullscreen.active ? "agent-workspace-fullscreen" : ""
        } ${className}`}
        data-agent-session-deck=""
        ref={deckRef}
      >
        <AgentSessionDeckStrip
          activeSessionId={resolvedActive}
          baseId={baseId}
          fullscreenActive={fullscreen.active}
          fullscreenSupported={fullscreen.supported}
          onActivate={activate}
          onCloseSession={onCloseSession}
          onCreateSession={onCreateSession}
          onToggleFullscreen={fullscreen.toggle}
          sessions={sessions}
        />
        {mounted.map((entry) => {
          const active = entry.sessionId === resolvedActive;
          return (
            <section
              aria-hidden={!active}
              aria-labelledby={`${baseId}-${entry.sessionId}-tab`}
              className={active ? "flex min-h-0 flex-1 flex-col" : "hidden"}
              id={`${baseId}-${entry.sessionId}-panel`}
              key={entry.sessionId}
              role="tabpanel"
            >
              <AgentWorkspace
                {...workspaceProps}
                className="flex-1"
                locale={locale}
                runtime={entry.runtime}
                sessionId={entry.sessionId}
                showFullscreen={false}
                terminalRuntime={entry.terminalRuntime}
              />
            </section>
          );
        })}
      </div>
    </AgentWorkspaceLocaleProvider>
  );
}

function AgentSessionDeckStrip({
  activeSessionId,
  baseId,
  fullscreenActive,
  fullscreenSupported,
  onActivate,
  onCloseSession,
  onCreateSession,
  onToggleFullscreen,
  sessions,
}: {
  activeSessionId?: string;
  baseId: string;
  fullscreenActive: boolean;
  fullscreenSupported: boolean;
  onActivate: (sessionId: string) => void;
  onCloseSession?: (sessionId: string) => void;
  onCreateSession?: () => void;
  onToggleFullscreen: () => void;
  sessions: readonly AgentSessionDeckEntry[];
}) {
  const text = useAgentWorkspaceText();
  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border px-2">
      <div
        aria-label={text.sessions}
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
        onKeyDown={focusAdjacentTab}
        role="tablist"
      >
        {sessions.map((entry) => (
          <AgentSessionDeckTab
            active={entry.sessionId === activeSessionId}
            entry={entry}
            id={`${baseId}-${entry.sessionId}-tab`}
            key={entry.sessionId}
            onActivate={() => onActivate(entry.sessionId)}
            onClose={
              onCloseSession ? () => onCloseSession(entry.sessionId) : undefined
            }
            panelId={`${baseId}-${entry.sessionId}-panel`}
          />
        ))}
      </div>
      {onCreateSession && (
        <button
          aria-label={text.newSession}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted-foreground hover:bg-muted/60"
          onClick={onCreateSession}
          type="button"
        >
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">{text.newSession}</span>
        </button>
      )}
      <WorkspaceFullscreenButton
        active={fullscreenActive}
        onToggle={onToggleFullscreen}
        supported={fullscreenSupported}
      />
    </div>
  );
}
