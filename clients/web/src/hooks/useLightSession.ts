"use client";

import { useSyncExternalStore } from "react";
import {
  LIGHT_SESSION_CHANGED_EVENT,
  readLightSession,
  type LightSession,
} from "@/lib/light-session";

const subscribe = (cb: () => void) => {
  const onStorage = (e: StorageEvent) => {
    if (e.key && (e.key.startsWith("agent-cloud-auth/") || e.key.startsWith("agentcloud-auth/"))) cb();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(LIGHT_SESSION_CHANGED_EVENT, cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LIGHT_SESSION_CHANGED_EVENT, cb);
  };
};

let cachedSession: LightSession | null = null;
let cachedKey = "";

const getSnapshot = (): LightSession | null => {
  const next = readLightSession();
  const nextKey = next ? `${next.expiresAt}:${next.currentOrgSlug}` : "";
  if (nextKey !== cachedKey) {
    cachedSession = next;
    cachedKey = nextKey;
  }
  return cachedSession;
};

const getServerSnapshot = (): LightSession | null => null;

const noopSubscribe = () => () => {};
const getHydratedClient = () => true;
const getHydratedServer = () => false;

export function useLightSession(): { session: LightSession | null; hydrated: boolean } {
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(noopSubscribe, getHydratedClient, getHydratedServer);
  return { session, hydrated };
}
