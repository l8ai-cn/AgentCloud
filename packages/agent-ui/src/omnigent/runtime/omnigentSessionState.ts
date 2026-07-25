import type {
  AgentConnectionStatus,
  AgentSessionStatus,
  AgentTimelineItem,
} from "../../contracts";

/**
 * Mutable working state for one bound session. Held mutable so a token-rate
 * delta stream costs an in-place string append rather than an array clone;
 * `revision` is what readers diff against to know a re-projection is due.
 */
export interface OmnigentSessionState {
  sessionId: string;
  title: string;
  agentLabel: string;
  status: AgentSessionStatus;
  connection: AgentConnectionStatus;
  items: AgentTimelineItem[];
  indexById: Map<string, number>;
  /** Turn currently in flight, or `null` when settled. */
  activeTurnId: string | null;
  /** Assistant message currently receiving text deltas. */
  streamingItemId: string | null;
  hasOlderItems: boolean;
  /** Pagination cursor: oldest raw history item seen, including unrendered kinds. */
  oldestItemId: string | null;
  error: string | null;
  revision: number;
}

export function createOmnigentSessionState(
  sessionId: string,
): OmnigentSessionState {
  return {
    sessionId,
    title: "",
    agentLabel: "",
    status: "idle",
    connection: "connecting",
    items: [],
    indexById: new Map(),
    activeTurnId: null,
    streamingItemId: null,
    hasOlderItems: false,
    oldestItemId: null,
    error: null,
    revision: 0,
  };
}

export function hasOmnigentItem(
  state: OmnigentSessionState,
  itemId: string,
): boolean {
  return state.indexById.has(itemId);
}

export function appendOmnigentItem(
  state: OmnigentSessionState,
  item: AgentTimelineItem,
): void {
  if (state.indexById.has(item.id)) return;
  state.indexById.set(item.id, state.items.length);
  state.items.push(item);
  state.revision++;
}

export function prependOmnigentItems(
  state: OmnigentSessionState,
  items: readonly AgentTimelineItem[],
): void {
  const fresh = items.filter((item) => !state.indexById.has(item.id));
  if (fresh.length === 0) return;
  state.items = [...fresh, ...state.items];
  reindexOmnigentItems(state);
  state.revision++;
}

export function updateOmnigentItem<T extends AgentTimelineItem>(
  state: OmnigentSessionState,
  itemId: string,
  update: (item: T) => T,
): void {
  const index = state.indexById.get(itemId);
  if (index === undefined) return;
  state.items[index] = update(state.items[index] as T);
  state.revision++;
}

/**
 * Rekey an item in place. Used when an optimistic message receives its
 * server-assigned id, so history dedupe and scroll anchors keep working
 * without the bubble jumping position.
 */
export function rekeyOmnigentItem(
  state: OmnigentSessionState,
  fromId: string,
  toId: string,
): void {
  const index = state.indexById.get(fromId);
  if (index === undefined) return;
  if (state.indexById.has(toId)) return;
  state.indexById.delete(fromId);
  state.indexById.set(toId, index);
  state.items[index] = { ...state.items[index], id: toId };
  if (state.streamingItemId === fromId) state.streamingItemId = toId;
  state.revision++;
}

export function removeOmnigentItem(
  state: OmnigentSessionState,
  itemId: string,
): void {
  const index = state.indexById.get(itemId);
  if (index === undefined) return;
  state.items.splice(index, 1);
  reindexOmnigentItems(state);
  if (state.streamingItemId === itemId) state.streamingItemId = null;
  state.revision++;
}

function reindexOmnigentItems(state: OmnigentSessionState): void {
  state.indexById.clear();
  state.items.forEach((item, index) => state.indexById.set(item.id, index));
}
