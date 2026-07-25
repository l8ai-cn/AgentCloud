/**
 * Coalesces subscriber notifications. A token-rate delta stream would
 * otherwise re-render the transcript once per token; batching to one frame
 * keeps streaming cost proportional to time rather than to token count.
 *
 * Injectable so tests can flush synchronously instead of driving frames.
 */
export type OmnigentScheduler = (callback: () => void) => () => void;

export const omnigentFrameScheduler: OmnigentScheduler = (callback) => {
  if (typeof requestAnimationFrame !== "function") {
    const timer = setTimeout(callback, 0);
    return () => clearTimeout(timer);
  }
  const handle = requestAnimationFrame(() => callback());
  return () => cancelAnimationFrame(handle);
};

export const omnigentSyncScheduler: OmnigentScheduler = (callback) => {
  callback();
  return () => {};
};

export class OmnigentNotifier {
  private cancel: (() => void) | null = null;

  constructor(
    private readonly schedule: OmnigentScheduler,
    private readonly flush: () => void,
  ) {}

  request(): void {
    if (this.cancel !== null) return;
    this.cancel = this.schedule(() => {
      this.cancel = null;
      this.flush();
    });
  }

  dispose(): void {
    this.cancel?.();
    this.cancel = null;
  }
}
