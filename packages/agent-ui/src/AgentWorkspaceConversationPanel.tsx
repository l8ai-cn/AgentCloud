import type { ReactNode } from "react";

import { AgentConversationSurface } from "./AgentConversationSurface";
import type { AgentArtifactItem, AgentSessionRuntime, AgentTimelineItem } from "./contracts";
import type { AgentSessionSnapshot } from "./contracts";
import type { WorkspaceFileSource } from "./conversation/mentions/workspaceFileSource";
import type { ContentRendererRegistry } from "./registry/ContentRendererRegistry";
import type { ToolRendererRegistry } from "./registry/ToolRendererRegistry";
import type { AgentContentRendererRegistration } from "./react/contentRendererTypes";
import type { AgentToolRendererRegistration } from "./react/rendererTypes";
import { ResultWorkbench } from "./react/ResultWorkbench";
import type { WorkbenchContainerMode } from "./react/useWorkbenchContainerMode";
import { PlanStrip } from "./PlanStrip";
import { UserTaskStatus } from "./UserTaskStatus";
import { UserVideoExecutionTrace } from "./VideoExecutionTrace";
import type { AgentWorkspacePresentation } from "./userWorkspacePresentation";
import type { UserVideoExecutionStep } from "./userVideoExecutionTrace";

export function AgentWorkspaceConversationPanel({
  presentation,
  snapshot,
  plan,
  allArtifacts,
  conversationItems,
  artifacts,
  videoExecutionSteps,
  contentRenderers,
  toolRenderers,
  runtime,
  sessionId,
  mode,
  workspaceArtifacts,
  workspaceFiles,
  mentionHarness,
  onError,
}: {
  presentation: AgentWorkspacePresentation;
  snapshot: AgentSessionSnapshot;
  plan: AgentSessionSnapshot["plan"];
  allArtifacts: AgentArtifactItem[];
  conversationItems: AgentTimelineItem[];
  artifacts: AgentArtifactItem[];
  videoExecutionSteps: UserVideoExecutionStep[];
  contentRenderers?: ContentRendererRegistry<AgentContentRendererRegistration>;
  toolRenderers?: ToolRendererRegistry<AgentToolRendererRegistration>;
  runtime: AgentSessionRuntime;
  sessionId: string;
  mode: WorkbenchContainerMode;
  workspaceArtifacts: readonly AgentArtifactItem[];
  workspaceFiles?: WorkspaceFileSource;
  mentionHarness?: string | null;
  onError: (message: string) => void;
}): ReactNode {
  return (
    <>
      {presentation === "developer" && <PlanStrip steps={plan} />}
      {presentation === "user" && (
        <UserTaskStatus artifacts={allArtifacts} snapshot={snapshot} />
      )}
      <ResultWorkbench
        artifacts={artifacts}
        contentRenderers={contentRenderers}
        conversation={
          <AgentConversationSurface
            contentRenderers={contentRenderers}
            executionTrace={
              videoExecutionSteps.length > 0 ? (
                <UserVideoExecutionTrace steps={videoExecutionSteps} />
              ) : undefined
            }
            items={conversationItems}
            mentionHarness={mentionHarness}
            onError={(cause) =>
              onError(cause instanceof Error ? cause.message : String(cause))
            }
            presentation={presentation}
            runtime={runtime}
            snapshot={snapshot}
            toolRenderers={toolRenderers}
            workspaceFiles={workspaceFiles}
          />
        }
        mode={mode}
        presentation={presentation}
        runtime={runtime}
        sessionId={sessionId}
        toolRenderers={toolRenderers}
        tools={
          presentation === "developer"
            ? conversationItems.filter((item) => item.kind === "tool")
            : []
        }
        verifiedArtifactsOnly={presentation === "user"}
        workspaceArtifacts={workspaceArtifacts}
      />
    </>
  );
}
