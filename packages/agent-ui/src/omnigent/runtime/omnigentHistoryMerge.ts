import type { AgentTimelineItem } from "../../contracts";
import { omnigentContentText } from "../protocol/omnigentMessageContent";
import type { OmnigentHistoryItem } from "../protocol/omnigentConversationItem";
import type { OmnigentHistoryPage } from "../transport/omnigentSessionHistoryApi";
import { prependOmnigentItems } from "./omnigentSessionState";
import type { OmnigentSessionState } from "./omnigentSessionState";

/**
 * Merge a page of committed history into the front of the timeline.
 *
 * The stream may already have delivered some of these items (a page fetched
 * while the live tail was open), so `prependOmnigentItems` drops ids already
 * present rather than double-rendering them.
 *
 * The pagination cursor tracks the oldest *raw* item, including kinds this
 * build does not yet render — otherwise paging would skip over them forever.
 */
export function mergeOmnigentHistoryPage(
  state: OmnigentSessionState,
  page: OmnigentHistoryPage,
): void {
  prependOmnigentItems(state, projectHistoryItems(page.items));
  const oldest = page.items[0];
  if (oldest !== undefined) state.oldestItemId = oldest.id;
  state.hasOlderItems = page.hasOlder;
}

function projectHistoryItems(
  items: readonly OmnigentHistoryItem[],
): AgentTimelineItem[] {
  const projected: AgentTimelineItem[] = [];
  for (const item of items) {
    if (item.type !== "message") continue;
    // Meta messages are durable hidden context, never shown in the transcript.
    if (item.isMeta) continue;
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
