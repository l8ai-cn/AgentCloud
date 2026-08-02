import type { AgentWorkspaceLocale } from "@agent-cloud/agent-ui";
import { useEffect, useRef, useState } from "react";

import {
  createEmbeddedAgentWorkbenchRuntime,
  type EmbeddedAgentWorkbenchRuntime,
} from "./createEmbeddedAgentWorkbenchRuntime";
import type { EmbeddedAgentWorkbenchAccess } from "./embeddedAgentWorkbenchAccess";

export interface EmbeddedWorkbenchSession {
  access: EmbeddedAgentWorkbenchAccess;
  workbench: EmbeddedAgentWorkbenchRuntime;
}

export function useEmbeddedWorkbenchRuntimes(
  accesses: readonly EmbeddedAgentWorkbenchAccess[],
  options: { fetch?: typeof globalThis.fetch; locale: AgentWorkspaceLocale },
) {
  const [sessions, setSessions] = useState<EmbeddedWorkbenchSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const accessKey = accesses
    .map((access) => `${access.baseUrl}|${access.orgSlug}|${access.sessionId}`)
    .join("||");
  const accessRef = useRef(accesses);
  useEffect(() => {
    accessRef.current = accesses;
  }, [accesses]);
  const { fetch, locale } = options;

  useEffect(() => {
    if (accessRef.current.length === 0) return;
    let active = true;
    let opened: EmbeddedWorkbenchSession[] = [];
    void Promise.all(
      accessRef.current.map(async (access) => ({
        access,
        workbench: await createEmbeddedAgentWorkbenchRuntime(access, { fetch }),
      })),
    ).then(
      (result) => {
        opened = result;
        if (active) setSessions(result);
        else result.forEach((s) => s.workbench.runtime.close(s.access.sessionId));
      },
      () => {
        if (active) {
          setError(
            locale === "zh-CN"
              ? "Worker 会话连接失败，请稍后重试"
              : "Failed to connect to the Worker session. Please try again.",
          );
        }
      },
    );
    return () => {
      active = false;
      opened.forEach((s) => s.workbench.runtime.close(s.access.sessionId));
      // 重连前必须清空上一会话的 runtime，否则会渲染已 close 的 runtime。
      setSessions(null);
      setError(null);
    };
  }, [accessKey, fetch, locale]);

  const missingAccess =
    accesses.length === 0
      ? locale === "zh-CN"
        ? "缺少嵌入会话参数"
        : "Missing embedded session parameters."
      : null;
  return { error: missingAccess ?? error, sessions };
}
