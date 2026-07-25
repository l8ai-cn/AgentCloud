import {
  parseOmnigentHistoryItem,
} from "../protocol/omnigentConversationItem";
import type { OmnigentHistoryItem } from "../protocol/omnigentConversationItem";
import { omnigentJson } from "./omnigentFetch";
import type { OmnigentFetch } from "./omnigentFetch";

export const OMNIGENT_HISTORY_PAGE_SIZE = 20;

/**
 * Bounds how far `fetchOmnigentInitialHistory` pages back chasing the
 * previous user prompt. A pathological single turn (thousands of tool calls
 * between two prompts) would otherwise fan out into unbounded requests; on
 * hitting the cap we stop with `hasOlder: true`, so the rest stays reachable
 * by scroll-up rather than being silently truncated.
 */
const MAX_INITIAL_PAGES = 8;

export interface OmnigentHistoryPage {
  items: OmnigentHistoryItem[];
  hasOlder: boolean;
}

interface HistoryPageWire {
  data: unknown[];
  has_more: boolean;
}

/**
 * One page of committed items, oldest-to-newest.
 *
 * The server orders by position, so we request the newest `limit` items
 * (`order=desc`, plus `after` the cursor when paging back) and reverse into
 * chronological order.
 */
export async function fetchOmnigentHistoryPage(
  request: OmnigentFetch,
  sessionId: string,
  options: { olderThan?: string; limit?: number } = {},
): Promise<OmnigentHistoryPage> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? OMNIGENT_HISTORY_PAGE_SIZE),
    order: "desc",
  });
  // "Older than the cursor" within a descending scan means after it.
  if (options.olderThan !== undefined) params.set("after", options.olderThan);
  const wire = await omnigentJson<HistoryPageWire>(
    await request(
      `/v1/sessions/${encodeURIComponent(sessionId)}/items?${params.toString()}`,
    ),
  );
  const items: OmnigentHistoryItem[] = [];
  for (const raw of wire.data) {
    const item = parseOmnigentHistoryItem(raw);
    if (item !== null) items.push(item);
  }
  return { items: items.reverse(), hasOlder: wire.has_more };
}

/**
 * Hydrate the opening window: at least one page, extended further back when
 * needed so the *previous* user prompt is on screen.
 *
 * A flat page size can land mid-turn when a turn carries many tool calls,
 * leaving the user looking at a reply with no visible prompt above it. Paging
 * until two non-meta user messages are in hand keeps the last full exchange
 * intact. The common case still costs a single request.
 */
export async function fetchOmnigentInitialHistory(
  request: OmnigentFetch,
  sessionId: string,
): Promise<OmnigentHistoryPage> {
  let items: OmnigentHistoryItem[] = [];
  let hasOlder = true;

  for (let page = 0; page < MAX_INITIAL_PAGES; page++) {
    // Serial by necessity: each request's cursor is the previous page's head.
    const cursor = items[0]?.id;
    const fetched = await fetchOmnigentHistoryPage(
      request,
      sessionId,
      cursor !== undefined ? { olderThan: cursor } : {},
    );
    items = [...fetched.items, ...items];
    hasOlder = fetched.hasOlder;
    if (!hasOlder) break;
    if (
      items.length >= OMNIGENT_HISTORY_PAGE_SIZE &&
      countUserPrompts(items) >= 2
    ) {
      break;
    }
    if (items[0]?.id === undefined) break;
  }

  return { items, hasOlder };
}

function countUserPrompts(items: readonly OmnigentHistoryItem[]): number {
  return items.filter(
    (item) => item.type === "message" && item.role === "user" && !item.isMeta,
  ).length;
}
