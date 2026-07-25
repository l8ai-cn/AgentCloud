/**
 * Ingress layers commonly recycle a single long-lived HTTP/2 stream after a
 * few minutes, so the client must re-subscribe on drop. Backoff applies only
 * between *consecutive failed opens* — a drop after a healthy connection
 * reconnects immediately, which is the common case and must stay invisible.
 */
export const OMNIGENT_RECONNECT_BASE_MS = 250;
export const OMNIGENT_RECONNECT_MAX_MS = 5_000;

/**
 * Halved-to-full jittered exponential backoff. Called only with
 * `failedOpens >= 1`, so the first retry starts at the base and doubles per
 * consecutive failure up to the cap.
 */
export function omnigentReconnectDelay(
  failedOpens: number,
  random: () => number = Math.random,
): number {
  const ceiling = Math.min(
    OMNIGENT_RECONNECT_BASE_MS * 2 ** (failedOpens - 1),
    OMNIGENT_RECONNECT_MAX_MS,
  );
  return ceiling / 2 + random() * (ceiling / 2);
}

/**
 * Resolve after `ms`, or immediately on abort, so unbinding a session cuts a
 * pending backoff short instead of stalling teardown behind it.
 */
export function omnigentDelay(
  ms: number,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timer = setTimeout(finish, ms);
    function finish(): void {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    }
    signal.addEventListener("abort", finish);
  });
}
