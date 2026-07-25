/**
 * Tracks optimistic user messages awaiting their server-assigned item id.
 *
 * Two reconciliation paths exist because native-terminal sessions round-trip
 * a web-composer message through the agent's transcript: those get a server
 * `pendingId` that comes back verbatim, so they can be claimed by id even
 * when the transcript reorders them. Everything else settles FIFO.
 */
export class OmnigentPendingQueue {
  private readonly order: string[] = [];
  private readonly pendingIdByLocalId = new Map<string, string>();
  private readonly localIdByPendingId = new Map<string, string>();

  enqueue(localId: string): void {
    this.order.push(localId);
  }

  attachPendingId(localId: string, pendingId: string): void {
    if (!this.order.includes(localId)) return;
    this.pendingIdByLocalId.set(localId, pendingId);
    this.localIdByPendingId.set(pendingId, localId);
  }

  /**
   * Resolve which optimistic message a `session.input.consumed` event
   * settles. Returns `null` when nothing is outstanding — the message was
   * typed directly in the agent's terminal rather than sent from here.
   */
  claim(clearedPendingId: string | null): string | null {
    if (clearedPendingId !== null) {
      const localId = this.localIdByPendingId.get(clearedPendingId);
      if (localId !== undefined) {
        this.forget(localId);
        return localId;
      }
      // The id names a pending entry this client never created; falling back
      // to FIFO would settle an unrelated bubble.
      return null;
    }
    const localId = this.order[0];
    if (localId === undefined) return null;
    this.forget(localId);
    return localId;
  }

  forget(localId: string): void {
    const position = this.order.indexOf(localId);
    if (position !== -1) this.order.splice(position, 1);
    const pendingId = this.pendingIdByLocalId.get(localId);
    if (pendingId !== undefined) this.localIdByPendingId.delete(pendingId);
    this.pendingIdByLocalId.delete(localId);
  }

  clear(): void {
    this.order.length = 0;
    this.pendingIdByLocalId.clear();
    this.localIdByPendingId.clear();
  }

  get outstanding(): readonly string[] {
    return this.order;
  }
}
