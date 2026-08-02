import type { AgentArtifactItem } from "../../agentArtifactContracts";
import { AgentWorkspace, type AgentWorkspaceProps } from "../../AgentWorkspace";
import type { AgentWorkspaceLocale } from "../../agentWorkspaceText";
import type { WorkerRef } from "../contracts";
import { useWorkerClient } from "./WorkerProvider";
import { WorkerLivenessView } from "./WorkerLivenessView";
import {
  useWorkerLiveness,
  useWorkerRuntime,
  useWorkerSessionId,
} from "./useWorkerSession";

export interface WorkerConversationProps {
  workerRef: WorkerRef;
  presentation?: AgentWorkspaceProps["presentation"];
  locale?: AgentWorkspaceLocale;
  className?: string;
  clientLabel?: string;
  contentRenderers?: AgentWorkspaceProps["contentRenderers"];
  domainPanel?: AgentWorkspaceProps["domainPanel"];
  headerActions?: AgentWorkspaceProps["headerActions"];
  showFullscreen?: AgentWorkspaceProps["showFullscreen"];
  toolRenderers?: AgentWorkspaceProps["toolRenderers"];
  workspaceArtifacts?: readonly AgentArtifactItem[];
  terminalRuntime?: AgentWorkspaceProps["terminalRuntime"];
}

export function WorkerConversation({
  workerRef,
  presentation = "developer",
  locale = "en-US",
  className = "",
  clientLabel,
  contentRenderers,
  domainPanel,
  headerActions,
  showFullscreen,
  toolRenderers,
  workspaceArtifacts,
  terminalRuntime,
}: WorkerConversationProps) {
  const client = useWorkerClient();
  const liveness = useWorkerLiveness(client, workerRef);
  const { sessionId, resolveError } = useWorkerSessionId(
    client,
    workerRef,
    liveness,
  );
  const runtime = useWorkerRuntime(client, workerRef, sessionId, liveness);
  const transport = client.transportFor(workerRef);

  if (resolveError) {
    return (
      <WorkerLivenessView
        className={className}
        locale={locale}
        liveness={{
          state: "unreachable",
          cause: { reason: "launch-failed", detail: resolveError },
          recovery: [],
        }}
      />
    );
  }

  if (liveness.state === "starting" || liveness.state === "unreachable") {
    return (
      <WorkerLivenessView
        className={className}
        locale={locale}
        liveness={liveness}
      />
    );
  }

  if (!sessionId || !runtime) {
    return (
      <WorkerLivenessView
        className={className}
        locale={locale}
        liveness={{ state: "starting", progress: null }}
      />
    );
  }

  return (
    <AgentWorkspace
      className={className}
      clientLabel={clientLabel}
      contentRenderers={contentRenderers}
      domainPanel={domainPanel}
      headerActions={headerActions}
      locale={locale}
      presentation={presentation}
      readOnly={liveness.state === "online" && liveness.readOnly !== null}
      runtime={runtime}
      sessionId={sessionId}
      showFullscreen={showFullscreen}
      terminalRuntime={terminalRuntime}
      toolRenderers={toolRenderers}
      workspaceArtifacts={workspaceArtifacts}
      workspaceFiles={transport.workspaceFiles}
    />
  );
}
