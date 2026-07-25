import type { OmnigentFetch } from "../../omnigent/transport/omnigentFetch";

export const POLL_OK_MS = 10_000;
export const POLL_MAX_MS = 60_000;

export type HealthEntry = { runnerOnline: boolean };
export type HealthMap = Map<string, HealthEntry>;

export interface OmnigentHealthPoll {
  setSessionIds(ids: readonly string[]): void;
  stop(): void;
}

interface BatchHealthResponse {
  sessions?: Record<string, { runner_online?: boolean }>;
}

export function createOmnigentHealthPoll(
  request: OmnigentFetch,
  onResult: (map: HealthMap) => void,
): OmnigentHealthPoll {
  let sessionIds: string[] = [];
  let delay = POLL_OK_MS;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = () => {
    clearTimer();
    if (stopped || sessionIds.length === 0) return;
    timer = setTimeout(() => {
      timer = null;
      void pollOnce();
    }, delay);
  };

  const pollOnce = async () => {
    if (stopped || sessionIds.length === 0 || inFlight) return;
    inFlight = true;
    const ids = sessionIds;
    let success = false;
    try {
      const param = ids.join(",");
      const response = await request(
        `/health?session_ids=${encodeURIComponent(param)}`,
      );
      if (stopped) return;
      if (response.ok) {
        const body = (await response.json()) as BatchHealthResponse;
        if (stopped) return;
        const next: HealthMap = new Map();
        for (const id of ids) {
          const entry = body.sessions?.[id];
          if (entry?.runner_online !== undefined) {
            next.set(id, { runnerOnline: entry.runner_online });
          }
        }
        onResult(next);
        success = true;
      }
    } catch {
      // Keep prior map; back off.
    } finally {
      inFlight = false;
    }
    if (stopped) return;
    delay = success ? POLL_OK_MS : Math.min(delay * 2, POLL_MAX_MS);
    schedule();
  };

  return {
    setSessionIds(ids) {
      const next = [...ids];
      const same =
        next.length === sessionIds.length &&
        next.every((id, index) => id === sessionIds[index]);
      if (same) return;
      sessionIds = next;
      delay = POLL_OK_MS;
      clearTimer();
      if (sessionIds.length === 0) {
        onResult(new Map());
        return;
      }
      void pollOnce();
    },
    stop() {
      stopped = true;
      clearTimer();
    },
  };
}
