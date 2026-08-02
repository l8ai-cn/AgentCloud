import { Bot, CircleAlert, Wifi, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { useAgentWorkspaceText } from "./AgentWorkspaceLocaleContext";
import type { AgentSessionSnapshot } from "./contracts";
import type { AgentWorkspacePresentation } from "./userWorkspacePresentation";

export function WorkspaceHeader({
  actions,
  presentation,
  snapshot,
  tabs,
}: {
  actions?: ReactNode;
  presentation: AgentWorkspacePresentation;
  snapshot: AgentSessionSnapshot;
  tabs?: ReactNode;
}) {
  const connected = snapshot.connection === "connected";
  const text = useAgentWorkspaceText();
  const model = currentModelLabel(snapshot);
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-2 sm:gap-3 sm:px-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Bot className="size-4" />
      </div>
      <div className="min-w-0 shrink basis-40">
        <div className="truncate text-sm font-medium">{snapshot.title}</div>
        <div className="hidden min-w-0 items-center gap-1.5 overflow-hidden text-xs text-muted-foreground sm:flex">
          <span className="shrink-0">{snapshot.agentLabel}</span>
          {presentation === "user" && model && (
            <span className="contents">
              <span aria-hidden="true">·</span>
              <span className="truncate" title={model}>
                {model}
              </span>
            </span>
          )}
          {presentation === "developer" &&
            (snapshot.metadata ?? []).map((item) => (
              <span className="contents" key={item.id}>
                <span aria-hidden="true">·</span>
                <span className="truncate" title={`${item.label}: ${item.value}`}>
                  {item.value}
                </span>
              </span>
            ))}
        </div>
      </div>
      {tabs}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {snapshot.status === "failed" ? (
            <CircleAlert className="size-3.5 text-destructive" />
          ) : connected ? (
            <Wifi className="size-3.5 text-emerald-600" />
          ) : (
            <WifiOff className="size-3.5" />
          )}
          <span className="hidden md:inline">
            {text.sessionStatus(snapshot.status, snapshot.connection)}
          </span>
        </div>
        {actions}
      </div>
    </header>
  );
}

function currentModelLabel(snapshot: AgentSessionSnapshot): string | null {
  const control = (snapshot.configuration ?? []).find(
    (item) => item.id === "model",
  );
  const value = control?.value?.trim();
  if (!value) return null;
  const option = control?.options.find((item) => item.value === value);
  return option?.label?.trim() || value;
}
