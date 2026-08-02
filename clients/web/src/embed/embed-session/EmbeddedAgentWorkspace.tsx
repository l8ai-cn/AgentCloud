import {
  AgentSessionDeck,
  AgentWorkspace,
  createBuiltinContentRenderers,
  createBuiltinToolRenderers,
  type AgentContentRendererRegistration,
  type AgentSessionDeckEntry,
  type AgentToolRendererRegistration,
  type AgentWorkspaceLocale,
  type ContentRendererRegistry,
  type ToolRendererRegistry,
} from "@agent-cloud/agent-ui";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ImageLightboxProvider } from "@/embed/ImageLightboxStub";
import type { EmbeddedAgentWorkbenchAccess } from "./embeddedAgentWorkbenchAccess";
import {
  useEmbeddedWorkbenchRuntimes,
  type EmbeddedWorkbenchSession,
} from "./useEmbeddedWorkbenchRuntimes";

export function EmbeddedAgentWorkspace({
  access,
  contentRenderers,
  fetch,
  locale = "zh-CN",
  sessions,
  toolRenderers,
}: {
  access?: EmbeddedAgentWorkbenchAccess;
  contentRenderers?: ContentRendererRegistry<AgentContentRendererRegistration>;
  fetch?: typeof globalThis.fetch;
  locale?: AgentWorkspaceLocale;
  sessions?: readonly EmbeddedAgentWorkbenchAccess[];
  toolRenderers?: ToolRendererRegistry<AgentToolRendererRegistration>;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <ImageLightboxProvider>
          <EmbeddedAgentWorkspaceContent
            access={access}
            contentRenderers={contentRenderers}
            fetch={fetch}
            locale={locale}
            sessions={sessions}
            toolRenderers={toolRenderers}
          />
        </ImageLightboxProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function EmbeddedAgentWorkspaceContent({
  access,
  contentRenderers,
  fetch,
  locale,
  sessions,
  toolRenderers,
}: {
  access?: EmbeddedAgentWorkbenchAccess;
  contentRenderers?: ContentRendererRegistry<AgentContentRendererRegistration>;
  fetch?: typeof globalThis.fetch;
  locale: AgentWorkspaceLocale;
  sessions?: readonly EmbeddedAgentWorkbenchAccess[];
  toolRenderers?: ToolRendererRegistry<AgentToolRendererRegistration>;
}) {
  const accesses = useMemo(
    () => sessions ?? (access ? [access] : []),
    [access, sessions],
  );
  const { error, sessions: workbenchSessions } = useEmbeddedWorkbenchRuntimes(
    accesses,
    { fetch, locale },
  );
  const builtinContentRenderers = useMemo(() => createBuiltinContentRenderers(), []);
  const builtinToolRenderers = useMemo(() => createBuiltinToolRenderers(), []);

  if (error) {
    return <WorkspaceState message={error} role="alert" />;
  }
  if (!workbenchSessions) {
    return <WorkspaceState message="正在连接 Agent Workspace…" role="status" />;
  }
  return (
    <EmbeddedWorkbenchView
      contentRenderers={contentRenderers ?? builtinContentRenderers}
      locale={locale}
      sessions={workbenchSessions}
      toolRenderers={toolRenderers ?? builtinToolRenderers}
    />
  );
}

function EmbeddedWorkbenchView({
  contentRenderers,
  locale,
  sessions,
  toolRenderers,
}: {
  contentRenderers: ContentRendererRegistry<AgentContentRendererRegistration>;
  locale: AgentWorkspaceLocale;
  sessions: EmbeddedWorkbenchSession[];
  toolRenderers: ToolRendererRegistry<AgentToolRendererRegistration>;
}) {
  const entries = useMemo<AgentSessionDeckEntry[]>(
    () =>
      sessions.map((session) => ({
        runtime: session.workbench.runtime,
        sessionId: session.access.sessionId,
        terminalRuntime: session.workbench.terminalRuntime,
      })),
    [sessions],
  );
  const first = sessions[0];
  return (
    <div className="h-full min-h-0 overflow-hidden">
      {sessions.length > 1 ? (
        <AgentSessionDeck
          clientLabel="agent-workspace-iframe"
          contentRenderers={contentRenderers}
          locale={locale}
          presentation="user"
          sessions={entries}
          toolRenderers={toolRenderers}
        />
      ) : first ? (
        <AgentWorkspace
          clientLabel="agent-workspace-iframe"
          contentRenderers={contentRenderers}
          locale={locale}
          presentation="user"
          runtime={first.workbench.runtime}
          sessionId={first.access.sessionId}
          terminalRuntime={first.workbench.terminalRuntime}
          toolRenderers={toolRenderers}
        />
      ) : null}
    </div>
  );
}

function WorkspaceState({ message, role }: { message: string; role: "alert" | "status" }) {
  return (
    <div
      className="flex h-full min-h-0 items-center justify-center px-6 text-center text-sm text-muted-foreground"
      role={role}
    >
      {message}
    </div>
  );
}
