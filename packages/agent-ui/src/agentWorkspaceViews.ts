import type { AgentArtifactItem, AgentSessionSnapshot, AgentTimelineItem } from "./contracts";
import { userVideoExecutionSteps, type UserVideoExecutionStep } from "./userVideoExecutionTrace";
import {
  type AgentWorkspacePresentation,
  userConversationItems,
  userVisibleArtifacts,
} from "./userWorkspacePresentation";

export interface AgentWorkspaceViews {
  allArtifacts: AgentArtifactItem[];
  artifacts: AgentArtifactItem[];
  conversationItems: AgentTimelineItem[];
  videoExecutionSteps: UserVideoExecutionStep[];
}

export function agentWorkspaceViews(
  snapshot: AgentSessionSnapshot,
  presentation: AgentWorkspacePresentation,
): AgentWorkspaceViews {
  const allArtifacts = snapshot.items.filter((item) => item.kind === "artifact");
  const allConversationItems = snapshot.items.filter(
    (item) => item.kind !== "artifact",
  );
  const forUser = presentation === "user";
  return {
    allArtifacts,
    artifacts: forUser ? userVisibleArtifacts(allArtifacts) : allArtifacts,
    conversationItems: forUser
      ? userConversationItems(allConversationItems)
      : allConversationItems,
    videoExecutionSteps: forUser
      ? userVideoExecutionSteps(snapshot, allArtifacts)
      : [],
  };
}
