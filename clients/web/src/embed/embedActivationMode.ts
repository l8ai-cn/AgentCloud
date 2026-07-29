export type EmbedActivationMode = "embed-context" | "host-session";

const HOST_SESSION_PARAM = "host_session";
const EMBED_CONTEXT_PARAM = "embed_context";

// Stays correct after `clearEmbedContextFromLocation` strips `embed_context`:
// only `host_session` decides the branch, and host-session mode never rewrites
// the query string.
export function readEmbedActivationMode(search: string): EmbedActivationMode {
  const params = new URLSearchParams(search);
  const hostSession = params.getAll(HOST_SESSION_PARAM);
  if (hostSession.length === 0) {
    return "embed-context";
  }
  if (params.has(EMBED_CONTEXT_PARAM)) {
    throw new Error("embed_context and host_session are mutually exclusive");
  }
  if (hostSession.length !== 1) {
    throw new Error("host_session must appear exactly once");
  }
  if (hostSession[0] !== "1") {
    throw new Error("host_session must be 1");
  }
  return "host-session";
}
