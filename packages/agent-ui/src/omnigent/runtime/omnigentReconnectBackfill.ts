import type { AgentTimelineItem } from "../../contracts";
import { omnigentContentText } from "../protocol/omnigentMessageContent";
import type { OmnigentHistoryItem } from "../protocol/omnigentConversationItem";
import type { OmnigentHistoryPage } from "../transport/omnigentSessionHistoryApi";
import {
  appendOmnigentItem,
  hasOmnigentItem,
} from "./omnigentSessionState";
import type { OmnigentSessionState } from "./omnigentSessionState";

/**
 * How far back the reconnect walk looks for overlap with the rendered
 * transcript before giving up. A single newest page is not enough: a gap
 * longer than one page would leave items no code path can ever fetch, since
 * paging older only ever walks back from the pre-gap window top.
 */
const MAX_BACKFILL_PAGES = 4;

/**
 * Splice in items that committed while the socket was dead.
 *
 * Their stream events fired into a closed connection and the live tail
 * cannot resupply them, so we walk newest-first until a page overlaps
 * something already rendered — or the conversation starts — then append the
 * non-overlapping remainder in chronological order.
 */
export async function backfillOmnigentGap(
  state: OmnigentSessionState,
  fetchPage: (olderThan?: string) => Promise<OmnigentHistoryPage>,
): Promise<void> {
  const gap: OmnigentHistoryItem[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_BACKFILL_PAGES; page++) {
    // Serial by necessity: each request's cursor is the previous page's head.
    const fetched = await fetchPage(cursor);
    const overlapping = fetched.items.some((item) =>
      hasOmnigentItem(state, item.id),
    );
    gap.unshift(...fetched.items.filter((item) => !hasOmnigentItem(state, item.id)));
    if (overlapping || !fetched.hasOlder) break;
    cursor = fetched.items[0]?.id;
    if (cursor === undefined) break;
  }

  for (const item of projectGapItems(gap)) appendOmnigentItem(state, item);
}

function projectGapItems(
  items: readonly OmnigentHistoryItem[],
): AgentTimelineItem[] {
  const projected: AgentTimelineItem[] = [];
  for (const item of items) {
    if (item.type !== "message" || item.isMeta) continue;
    projected.push({
      id: item.id,
      kind: "message",
      role: item.role,
      text: omnigentContentText(item.content),
      status: "completed",
    });
  }
  return projected;
}
