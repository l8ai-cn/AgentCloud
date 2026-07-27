import { useEffect, useMemo, useState } from "react";

import {
  clearEmbedContextFromLocation,
  inspectEmbedContextOnce,
  readEmbedContext,
  redeemEmbedContextOnce,
  type EmbedContextBootstrap,
  type EmbedSessionAccess,
} from "@/embed-context";
import { EmbeddedAgentWorkspace } from "./EmbeddedAgentWorkspace";
import type { EmbeddedAgentWorkbenchAccess } from "./embeddedAgentWorkbenchAccess";
import { EMBED_READY_MESSAGE, readAllowedEmbedOpenProof } from "./embedParentHandshake";

const EMBED_OPEN_ERROR = "无法打开嵌入会话，请刷新或联系管理员。";

// React Strict Mode remounts in dev after the first effect clears the URL
// query; keep the one-shot context / access in module scope across remounts.
let retainedEmbedContext: string | null = null;
let retainedSessionAccess: EmbedSessionAccess | null = null;
let redemptionInFlight: Promise<EmbedSessionAccess> | null = null;

function takeEmbedContextFromLocation(): string {
  try {
    const context = readEmbedContext(window.location.search);
    retainedEmbedContext = context;
    return context;
  } catch (error) {
    if (retainedEmbedContext) {
      return retainedEmbedContext;
    }
    throw error;
  }
}

export function EmbeddedSessionIframe() {
  const [access, setAccess] = useState<EmbedSessionAccess | null>(
    retainedSessionAccess,
  );
  const [pendingContext, setPendingContext] = useState<{
    bootstrap: EmbedContextBootstrap;
    context: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const open = async () => {
      try {
        if (retainedSessionAccess) {
          if (active) setAccess(retainedSessionAccess);
          return;
        }
        const context = takeEmbedContextFromLocation();
        if (window.parent === window) {
          throw new Error("Embedded session must be opened in an iframe");
        }
        const bootstrap = await inspectEmbedContextOnce(context);
        if (!active) return;
        clearEmbedContextFromLocation();
        setPendingContext({ bootstrap, context });
      } catch {
        if (active) setError(EMBED_OPEN_ERROR);
      }
    };
    void open();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!pendingContext || retainedSessionAccess) return;
    const onMessage = (event: MessageEvent) => {
      const proof = readAllowedEmbedOpenProof(
        event,
        window.parent,
        pendingContext.bootstrap.parentOrigins,
      );
      if (!proof) return;
      if (!redemptionInFlight) {
        redemptionInFlight = redeemEmbedContextOnce(
          pendingContext.context,
          proof,
        );
        void redemptionInFlight.then(
          (nextAccess) => {
            retainedSessionAccess = nextAccess;
            retainedEmbedContext = null;
            setAccess(nextAccess);
            setPendingContext(null);
          },
          () => {
            redemptionInFlight = null;
            setError(EMBED_OPEN_ERROR);
          },
        );
      }
    };
    window.addEventListener("message", onMessage);
    pendingContext.bootstrap.parentOrigins.forEach((origin) =>
      window.parent.postMessage({ type: EMBED_READY_MESSAGE, version: 1 }, origin),
    );
    return () => window.removeEventListener("message", onMessage);
  }, [pendingContext]);

  const workbenchAccess = useMemo<EmbeddedAgentWorkbenchAccess | null>(
    () =>
      access
        ? {
            baseUrl: window.location.origin,
            getAccessToken: () => access.accessToken,
            orgSlug: access.orgSlug,
            sessionId: access.sessionId,
          }
        : null,
    [access],
  );

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="font-medium">无法打开嵌入会话</h1>
        <p className="text-sm text-muted-foreground">
          {error}
        </p>
      </div>
    );
  }
  if (!workbenchAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        正在等待嵌入页面建立连接…
      </div>
    );
  }
  return <EmbeddedAgentWorkspace access={workbenchAccess} />;
}
