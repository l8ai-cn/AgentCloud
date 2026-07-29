import { useEffect, useMemo, useState } from "react";

import {
  clearEmbedContextFromLocation,
  inspectEmbedContextOnce,
  readEmbedContext,
  redeemEmbedContextOnce,
  type EmbedContextBootstrap,
  type EmbedSessionAccess,
} from "@/embed/embed-context";
import { EmbeddedAgentWorkspace } from "./EmbeddedAgentWorkspace";
import { EmbeddedSessionNotice } from "./EmbeddedSessionNotice";
import type { EmbeddedAgentWorkbenchAccess } from "./embeddedAgentWorkbenchAccess";
import { embedCapabilitySessionRoute } from "./embeddedSessionApiRoute";
import { EMBED_READY_MESSAGE, readAllowedEmbedOpenProof } from "./embedParentHandshake";

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

export function EmbedContextSessionIframe() {
  const [access, setAccess] = useState<EmbedSessionAccess | null>(
    retainedSessionAccess,
  );
  const [pendingContext, setPendingContext] = useState<{
    bootstrap: EmbedContextBootstrap;
    context: string;
  } | null>(null);
  const [failed, setFailed] = useState(false);

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
        if (active) setFailed(true);
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
            // Allow a later open-proof to retry; keep in-flight on success.
            redemptionInFlight = null;
            setFailed(true);
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
            sessionApi: embedCapabilitySessionRoute(access.sessionId),
            sessionId: access.sessionId,
          }
        : null,
    [access],
  );

  if (failed) {
    return <EmbeddedSessionNotice status="error" />;
  }
  if (!workbenchAccess) {
    return <EmbeddedSessionNotice status="waiting" />;
  }
  return <EmbeddedAgentWorkspace access={workbenchAccess} />;
}
