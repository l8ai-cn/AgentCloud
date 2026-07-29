// Host-session mode has no embed context to inspect, so there is no
// server-issued origin allowlist. The embedding document's origin is the only
// first-party fact available to bind the handshake to, which means hosts must
// not strip the referrer from the iframe.
export function readHostSessionParentOrigin(referrer: string): string {
  let parsed: URL;
  try {
    parsed = new URL(referrer);
  } catch {
    throw new Error("host_session_parent_origin_unavailable");
  }
  if (parsed.origin === "null") {
    throw new Error("host_session_parent_origin_unavailable");
  }
  return parsed.origin;
}
