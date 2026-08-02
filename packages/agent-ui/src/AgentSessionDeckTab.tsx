import { X } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

import { useAgentWorkspaceText } from "./AgentWorkspaceLocaleContext";
import type { AgentSessionRuntime, AgentSessionSnapshot, TerminalRuntime } from "./contracts";

export interface AgentSessionDeckEntry {
  fallbackTitle?: string;
  runtime: AgentSessionRuntime;
  sessionId: string;
  terminalRuntime?: TerminalRuntime;
}

export function AgentSessionDeckTab({
  active,
  entry,
  id,
  onActivate,
  onClose,
  panelId,
}: {
  active: boolean;
  entry: AgentSessionDeckEntry;
  id: string;
  onActivate: () => void;
  onClose?: () => void;
  panelId: string;
}) {
  const text = useAgentWorkspaceText();
  const subscribe = useCallback(
    (listener: () => void) => {
      try {
        return entry.runtime.subscribe(entry.sessionId, listener);
      } catch {
        return () => undefined;
      }
    },
    [entry],
  );
  const readSnapshot = useCallback(() => readSessionSnapshot(entry), [entry]);
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, readSnapshot);
  const title = snapshot?.title.trim() || entry.fallbackTitle || entry.sessionId;
  return (
    <div
      aria-controls={panelId}
      aria-label={title}
      aria-selected={active}
      className={`flex h-8 max-w-48 shrink-0 items-center gap-1.5 rounded-md pl-2.5 text-xs ${
        onClose ? "pr-1" : "pr-2.5"
      } ${active ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60"}`}
      id={id}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate();
        }
      }}
      role="tab"
      tabIndex={active ? 0 : -1}
      title={title}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 shrink-0 rounded-full ${sessionToneClass(snapshot)}`}
      />
      <span className="truncate">{title}</span>
      {onClose && (
        <button
          aria-label={text.closeSession(title)}
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background/60 hover:text-foreground"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          type="button"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

function readSessionSnapshot(
  entry: AgentSessionDeckEntry,
): AgentSessionSnapshot | null {
  try {
    return entry.runtime.getSnapshot(entry.sessionId);
  } catch {
    return null;
  }
}

function sessionToneClass(snapshot: AgentSessionSnapshot | null): string {
  if (!snapshot) return "bg-muted-foreground/40";
  if (snapshot.status === "failed") return "bg-destructive";
  if (["launching", "running", "waiting"].includes(snapshot.status)) {
    return "animate-pulse bg-amber-500";
  }
  if (snapshot.connection === "connected") return "bg-emerald-500";
  return "bg-muted-foreground/40";
}
