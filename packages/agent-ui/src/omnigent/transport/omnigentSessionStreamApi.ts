import { omnigentApiError } from "./omnigentFetch";
import type { OmnigentFetch } from "./omnigentFetch";

/**
 * Open the session live-tail. Holding this stream open also registers the
 * user as a session viewer, so the caller owns aborting it via `signal`.
 *
 * Returns the raw byte stream; HTTP failures surface as a thrown
 * `OmnigentApiError` rather than a non-OK response, because a stream with no
 * body has nothing for the caller to inspect.
 */
export async function openOmnigentSessionStream(
  request: OmnigentFetch,
  sessionId: string,
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const response = await request(
    `/v1/sessions/${encodeURIComponent(sessionId)}/stream`,
    { headers: { Accept: "text/event-stream" }, signal },
  );
  if (!response.ok) throw await omnigentApiError(response);
  if (response.body === null) {
    throw new Error("omnigent session stream returned no body");
  }
  return response.body;
}
