import type { AgentWorkspaceLocale } from "../../agentWorkspaceText";
import type { WorkerLiveness } from "../liveness/workerLiveness";

interface LivenessCopy {
  starting: string;
  orphaned: string;
  launchFailed: string;
  forbidden: string;
  stranded: string;
  reconnectCli: string;
}

const COPY: Record<AgentWorkspaceLocale, LivenessCopy> = {
  "en-US": {
    starting: "Waiting for Worker to be ready…",
    orphaned: "Worker is reconnecting. Please wait.",
    launchFailed: "The Worker failed to start. Please try again.",
    forbidden: "You no longer have access to this Worker.",
    stranded: "Session offline — reconnect to continue.",
    reconnectCli: "Reconnect with:",
  },
  "zh-CN": {
    starting: "正在等待 Worker 就绪…",
    orphaned: "Worker 正在重连，请稍候。",
    launchFailed: "Worker 启动失败，请稍后重试。",
    forbidden: "你没有访问该 Worker 的权限。",
    stranded: "会话离线 — 请重连后继续。",
    reconnectCli: "使用以下命令重连：",
  },
};

export function WorkerLivenessView({
  liveness,
  locale = "en-US",
  className = "",
}: {
  liveness: WorkerLiveness;
  locale?: AgentWorkspaceLocale;
  className?: string;
}) {
  const copy = COPY[locale] ?? COPY["en-US"];
  const message = messageFor(liveness, copy);
  const role = liveness.state === "unreachable" ? "alert" : "status";
  const cli =
    liveness.state === "unreachable"
      ? liveness.recovery.find((item) => item.kind === "cli")
      : undefined;

  return (
    <div
      className={`flex h-full min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground ${className}`}
      role={role}
    >
      <div className="max-w-sm space-y-2">
        <p>{message}</p>
        {liveness.state === "starting" && liveness.progress ? (
          <p className="text-xs opacity-80">{liveness.progress}</p>
        ) : null}
        {liveness.state === "unreachable" &&
        liveness.cause.reason === "launch-failed" &&
        liveness.cause.detail ? (
          <p className="text-xs opacity-80">{liveness.cause.detail}</p>
        ) : null}
        {cli && cli.kind === "cli" ? (
          <div className="pt-2 text-left">
            <p className="mb-1 text-xs">{copy.reconnectCli}</p>
            <pre className="overflow-x-auto rounded bg-muted/40 p-2 text-xs whitespace-pre-wrap">
              {cli.command}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function messageFor(liveness: WorkerLiveness, copy: LivenessCopy): string {
  if (liveness.state === "starting") return copy.starting;
  if (liveness.state === "unreachable") {
    if (liveness.cause.reason === "orphaned") return copy.orphaned;
    if (liveness.cause.reason === "stranded") return copy.stranded;
    if (liveness.cause.reason === "forbidden") return copy.forbidden;
    return copy.launchFailed;
  }
  return copy.starting;
}
