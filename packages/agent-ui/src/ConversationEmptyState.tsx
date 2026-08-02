import { useAgentWorkspaceText } from "./AgentWorkspaceLocaleContext";
import { CONVERSATION_CONTENT_WIDTH } from "./conversationContentWidth";

export function ConversationEmptyState({
  agentLabel,
}: {
  agentLabel: string;
}) {
  const text = useAgentWorkspaceText();
  return (
    <div className={`${CONVERSATION_CONTENT_WIDTH} shrink-0 px-4 text-center`}>
      <h2 className="text-2xl font-medium leading-tight">
        {text.emptyHeading(agentLabel)}
      </h2>
    </div>
  );
}
