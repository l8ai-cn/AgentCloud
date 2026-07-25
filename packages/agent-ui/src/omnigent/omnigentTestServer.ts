import type { OmnigentFetch } from "./transport/omnigentFetch";

interface HistoryItemWire {
  id: string;
  type: string;
  role?: string;
  content?: Array<{ type: string; text: string }>;
  response_id?: string;
  is_meta?: boolean;
}

export function userItem(id: string, text: string): HistoryItemWire {
  return { id, type: "message", role: "user", content: [{ type: "input_text", text }] };
}

export function assistantItem(id: string, text: string): HistoryItemWire {
  return {
    id,
    type: "message",
    role: "assistant",
    content: [{ type: "output_text", text }],
  };
}

/**
 * In-memory stand-in for the Omnigent `/v1` surface, with a pushable live
 * tail so tests drive event ordering explicitly instead of racing timers.
 */
export class OmnigentTestServer {
  session: Record<string, unknown> = {
    id: "conv_1",
    agent_id: "agent_1",
    agent_name: "Coder",
    title: "Session",
    status: "idle",
  };
  items: HistoryItemWire[] = [];
  eventReceipt: Record<string, unknown> = { queued: true };
  readonly postedEvents: unknown[] = [];
  streamOpenCount = 0;
  /** Number of subsequent stream opens that reject before one succeeds. */
  failNextStreamOpens = 0;

  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private readonly encoder = new TextEncoder();
  private historyGate: Promise<void> | null = null;
  private releaseHistory: (() => void) | null = null;

  readonly fetch: OmnigentFetch = async (path, init) => {
    const url = new URL(path, "http://omnigent.test");
    if (url.pathname.endsWith("/stream")) return this.openStream(init?.signal);
    if (url.pathname.endsWith("/items")) {
      if (this.historyGate !== null) await this.historyGate;
      return json(this.historyPage(url));
    }
    if (url.pathname.endsWith("/events")) {
      this.postedEvents.push(JSON.parse(String(init?.body ?? "{}")));
      return json(this.eventReceipt);
    }
    return json(this.session);
  };

  emit(event: string, data: Record<string, unknown>): void {
    this.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  emitDone(): void {
    this.write("data: [DONE]\n\n");
    this.controller?.close();
    this.controller = null;
  }

  /** End the connection without the sentinel — the transport-drop path. */
  dropStream(): void {
    this.controller?.close();
    this.controller = null;
  }

  get streamOpen(): boolean {
    return this.controller !== null;
  }

  /** Hold history responses so a test can interleave stream events with hydration. */
  pauseHistory(): void {
    this.historyGate = new Promise<void>((resolve) => {
      this.releaseHistory = resolve;
    });
  }

  resumeHistory(): void {
    this.releaseHistory?.();
    this.historyGate = null;
    this.releaseHistory = null;
  }

  private write(chunk: string): void {
    this.controller?.enqueue(this.encoder.encode(chunk));
  }

  private openStream(signal?: AbortSignal | null): Response {
    this.streamOpenCount++;
    if (this.failNextStreamOpens > 0) {
      this.failNextStreamOpens--;
      return new Response("nope", { status: 503 });
    }
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.controller = controller;
        signal?.addEventListener("abort", () => {
          this.controller = null;
          try {
            controller.close();
          } catch {
            // Already closed by a concurrent drop.
          }
        });
      },
    });
    return new Response(body, { status: 200 });
  }

  /**
   * `order=desc` with `after=<id>` means "older than that id" within the
   * descending scan, matching the server's cursor semantics.
   */
  private historyPage(url: URL): { data: HistoryItemWire[]; has_more: boolean } {
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const after = url.searchParams.get("after");
    const end =
      after === null
        ? this.items.length
        : this.items.findIndex((item) => item.id === after);
    const upper = end === -1 ? this.items.length : end;
    const start = Math.max(0, upper - limit);
    return {
      data: this.items.slice(start, upper).reverse(),
      has_more: start > 0,
    };
  }
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
