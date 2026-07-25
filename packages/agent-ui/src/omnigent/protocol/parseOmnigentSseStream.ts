import { parseOmnigentEvent } from "./parseOmnigentEvent";
import type { OmnigentStreamEvent } from "./omnigentStreamEvents";

/**
 * Out-param carrying the stream's terminal condition. A clean server close
 * (`[DONE]` sentinel) must be distinguishable from a transport drop, because
 * only the latter warrants a reconnect.
 */
export interface OmnigentStreamOutcome {
  sawDone: boolean;
}

const DONE_SENTINEL = "[DONE]";

/**
 * Drain an SSE byte stream into typed events.
 *
 * Uses `getReader()` rather than async iteration: `ReadableStream`'s
 * async-iterator protocol only landed in Safari 17.4, and older iOS Safari
 * throws on iteration — which surfaces to the user as a silently blank reply.
 */
export async function* parseOmnigentSseStream(
  byteStream: ReadableStream<Uint8Array>,
  outcome?: OmnigentStreamOutcome,
): AsyncIterable<OmnigentStreamEvent> {
  const decoder = new TextDecoder("utf-8");
  const reader = byteStream.getReader();
  let buffer = "";
  let eventName: string | null = null;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const line = stripCarriageReturn(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);

        if (line.startsWith("event: ")) {
          eventName = line.slice(7);
        } else if (line.startsWith("data: ")) {
          const payload = line.slice(6);
          // The sentinel arrives as a bare `data:` line with no preceding
          // `event:`, so it must be matched before the eventName guard.
          if (payload.trim() === DONE_SENTINEL) {
            if (outcome) outcome.sawDone = true;
            return;
          }
          if (eventName !== null) {
            const event = decodeEvent(eventName, payload);
            if (event !== null) yield event;
            eventName = null;
          }
        } else if (line === "") {
          eventName = null;
        }

        newline = buffer.indexOf("\n");
      }
    }
  } finally {
    // Emulate the async-iterator protocol's auto-cancel: when the consumer
    // breaks out early, close the connection instead of leaving the fetch
    // in flight until GC.
    reader.cancel().catch(() => {});
  }
}

function decodeEvent(
  eventName: string,
  payload: string,
): OmnigentStreamEvent | null {
  try {
    const data = JSON.parse(payload) as unknown;
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return null;
    }
    return parseOmnigentEvent(eventName, data as Record<string, unknown>);
  } catch {
    return null;
  }
}

function stripCarriageReturn(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}
