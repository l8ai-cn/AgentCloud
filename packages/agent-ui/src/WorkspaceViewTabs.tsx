import { MessageSquare, Terminal } from "lucide-react";

import { useAgentWorkspaceText } from "./AgentWorkspaceLocaleContext";
import { focusAdjacentTab } from "./react/tabKeyboardNavigation";
import { WorkspaceViewTab } from "./WorkspaceViewTab";

export type WorkspaceView = "conversation" | "terminal";

export function WorkspaceViewTabs({
  conversationPanelId,
  conversationTabId,
  onViewChange,
  terminalEnabled,
  terminalPanelId,
  terminalTabId,
  view,
}: {
  conversationPanelId: string;
  conversationTabId: string;
  onViewChange: (view: WorkspaceView) => void;
  terminalEnabled: boolean;
  terminalPanelId: string;
  terminalTabId: string;
  view: WorkspaceView;
}) {
  const text = useAgentWorkspaceText();
  return (
    <nav
      aria-label={text.workspaceViews}
      className="flex items-center gap-1"
      onKeyDown={focusAdjacentTab}
      role="tablist"
    >
      <WorkspaceViewTab
        active={view === "conversation"}
        icon={<MessageSquare className="size-3.5" />}
        id={conversationTabId}
        label={text.conversation}
        onClick={() => onViewChange("conversation")}
        panelId={conversationPanelId}
      />
      {terminalEnabled && (
        <WorkspaceViewTab
          active={view === "terminal"}
          icon={<Terminal className="size-3.5" />}
          id={terminalTabId}
          label={text.terminal}
          onClick={() => onViewChange("terminal")}
          panelId={terminalPanelId}
        />
      )}
    </nav>
  );
}
