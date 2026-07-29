export const HOST_SESSION_MESSAGE = "agentcloud.embed.host-session";

export interface HostSessionCredential {
  accessToken: string;
  orgSlug: string;
  podKey: string;
}

export function readAllowedHostSessionCredential(
  event: Pick<MessageEvent, "origin" | "source" | "data">,
  parentWindow: Window,
  allowedOrigins: readonly string[],
): HostSessionCredential | null {
  if (event.source !== parentWindow || !allowedOrigins.includes(event.origin)) {
    return null;
  }
  if (typeof event.data !== "object" || event.data === null) {
    return null;
  }
  const payload = event.data as {
    type?: unknown;
    version?: unknown;
    accessToken?: unknown;
    orgSlug?: unknown;
    podKey?: unknown;
  };
  if (payload.type !== HOST_SESSION_MESSAGE || payload.version !== 1) {
    return null;
  }
  if (
    !isFilledString(payload.accessToken) ||
    !isFilledString(payload.orgSlug) ||
    !isFilledString(payload.podKey)
  ) {
    return null;
  }
  return {
    accessToken: payload.accessToken,
    orgSlug: payload.orgSlug,
    podKey: payload.podKey,
  };
}

function isFilledString(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}
