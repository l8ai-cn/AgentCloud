import type { AgentConnectionStatus } from "../../contracts";
import { parseOmnigentSseStream } from "../protocol/parseOmnigentSseStream";
import type { OmnigentStreamEvent } from "../protocol/omnigentStreamEvents";
import {
  omnigentDelay,
  omnigentReconnectDelay,
} from "./omnigentReconnectBackoff";

export interface OmnigentStreamPumpOptions {
  signal: AbortSignal;
  openStream: (signal: AbortSignal) => Promise<ReadableStream<Uint8Array>>;
  onEvent: (event: OmnigentStreamEvent) => void;
  onConnectionChange: (status: AgentConnectionStatus) => void;
  /** Splice in items that committed while the socket was dead. */
  onReconnected: () => Promise<void>;
  random?: () => number;
}

/**
 * Own the live tail for the lifetime of a bound session, reconnecting
 * transparently across drops.
 *
 * Exits only on abort or on the server's `[DONE]` sentinel; every other end
 * is treated as a transport drop worth re-subscribing to.
 */
export async function runOmnigentStreamPump(
  options: OmnigentStreamPumpOptions,
): Promise<void> {
  const { signal, openStream, onEvent, onConnectionChange } = options;
  let failedOpens = 0;
  let everConnected = false;

  while (!signal.aborted) {
    onConnectionChange(everConnected ? "reconnecting" : "connecting");

    let stream: ReadableStream<Uint8Array>;
    try {
      stream = await openStream(signal);
    } catch {
      if (signal.aborted) break;
      failedOpens++;
      await omnigentDelay(
        omnigentReconnectDelay(failedOpens, options.random),
        signal,
      );
      continue;
    }

    failedOpens = 0;
    onConnectionChange("connected");
    if (everConnected) {
      // Awaited before draining so gap items land ahead of the live events
      // that follow them, rather than racing into the wrong order.
      await options.onReconnected();
    }
    everConnected = true;

    const outcome = { sawDone: false };
    try {
      for await (const event of parseOmnigentSseStream(stream, outcome)) {
        if (signal.aborted) return;
        onEvent(event);
      }
    } catch {
      // A mid-stream transport error is indistinguishable from a drop.
    }

    if (signal.aborted) break;
    if (outcome.sawDone) {
      onConnectionChange("disconnected");
      return;
    }
    // A drop after a healthy connection reconnects immediately; only
    // consecutive failed opens back off.
  }

  onConnectionChange("disconnected");
}
