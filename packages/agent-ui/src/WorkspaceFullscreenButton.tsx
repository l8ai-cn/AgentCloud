import { Maximize, Minimize } from "lucide-react";

import { useAgentWorkspaceText } from "./AgentWorkspaceLocaleContext";

export function WorkspaceFullscreenButton({
  active,
  supported,
  onToggle,
}: {
  active: boolean;
  supported: boolean;
  onToggle: () => void;
}) {
  const text = useAgentWorkspaceText();
  if (!supported) return null;
  const label = active ? text.exitFullscreen : text.enterFullscreen;
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60"
      onClick={onToggle}
      title={label}
      type="button"
    >
      {active ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
    </button>
  );
}
