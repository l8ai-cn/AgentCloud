import { useEffect, useMemo, useState } from "react";

import { EmbeddedAgentWorkspace } from "@/embed/embed-session/EmbeddedAgentWorkspace";
import { EmbeddedSessionNotice } from "@/embed/embed-session/EmbeddedSessionNotice";
import type { EmbeddedAgentWorkbenchAccess } from "@/embed/embed-session/embeddedAgentWorkbenchAccess";
import { orgMemberSessionRoute } from "@/embed/embed-session/embeddedSessionApiRoute";
import { EMBED_READY_MESSAGE } from "@/embed/embed-session/embedParentHandshake";
import {
  createHostSessionCredentialStore,
  type HostSessionIdentity,
} from "./hostSessionCredentialStore";
import { readAllowedHostSessionCredential } from "./hostSessionHandshake";
import { readHostSessionParentOrigin } from "./hostSessionParentOrigin";
import { resolveHostSessionId } from "./hostSessionPodLookup";

export function HostSessionIframe() {
  const [store] = useState(createHostSessionCredentialStore);
  const [identity, setIdentity] = useState<HostSessionIdentity | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let parentOrigin: string;
    try {
      if (window.parent === window) {
        throw new Error("host_session_requires_iframe");
      }
      parentOrigin = readHostSessionParentOrigin(document.referrer);
    } catch {
      setFailed(true);
      return;
    }
    const onMessage = (event: MessageEvent) => {
      const credential = readAllowedHostSessionCredential(event, window.parent, [
        parentOrigin,
      ]);
      if (!credential) return;
      const update = store.accept(credential);
      if (update.kind === "established") {
        setIdentity(update.identity);
      } else if (update.kind === "identity-conflict") {
        setFailed(true);
      }
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: EMBED_READY_MESSAGE, version: 1 }, parentOrigin);
    return () => window.removeEventListener("message", onMessage);
  }, [store]);

  useEffect(() => {
    if (!identity) return;
    let active = true;
    void resolveHostSessionId({ ...identity, accessToken: store.getAccessToken() }).then(
      (resolved) => {
        if (active) setSessionId(resolved);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [identity, store]);

  const workbenchAccess = useMemo<EmbeddedAgentWorkbenchAccess | null>(
    () =>
      identity && sessionId
        ? {
            baseUrl: window.location.origin,
            getAccessToken: store.getAccessToken,
            orgSlug: identity.orgSlug,
            sessionApi: orgMemberSessionRoute(sessionId, identity.orgSlug),
            sessionId,
          }
        : null,
    [identity, sessionId, store],
  );

  if (failed) {
    return <EmbeddedSessionNotice status="error" />;
  }
  if (!workbenchAccess) {
    return <EmbeddedSessionNotice status="waiting" />;
  }
  return <EmbeddedAgentWorkspace access={workbenchAccess} />;
}
