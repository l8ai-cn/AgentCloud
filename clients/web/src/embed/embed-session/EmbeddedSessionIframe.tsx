import { useMemo, useSyncExternalStore } from "react";

import {
  readEmbedActivationMode,
  type EmbedActivationMode,
} from "@/embed/embedActivationMode";
import { HostSessionIframe } from "@/embed/host-session/HostSessionIframe";
import { EmbedContextSessionIframe } from "./EmbedContextSessionIframe";
import { EmbeddedSessionNotice } from "./EmbeddedSessionNotice";

type Activation = { mode: EmbedActivationMode } | { mode: null };

const neverResubscribe = () => () => {};
const readSearch = () => window.location.search;
const noSearchOnServer = () => null;

export function EmbeddedSessionIframe() {
  const search = useSyncExternalStore(neverResubscribe, readSearch, noSearchOnServer);
  const activation = useMemo<Activation | null>(() => {
    if (search === null) return null;
    try {
      return { mode: readEmbedActivationMode(search) };
    } catch {
      return { mode: null };
    }
  }, [search]);

  if (!activation) {
    return <EmbeddedSessionNotice status="waiting" />;
  }
  if (activation.mode === null) {
    return <EmbeddedSessionNotice status="error" />;
  }
  return activation.mode === "host-session" ? (
    <HostSessionIframe />
  ) : (
    <EmbedContextSessionIframe />
  );
}
