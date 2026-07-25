import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  POLL_MAX_MS,
  POLL_OK_MS,
  createOmnigentHealthPoll,
} from "./omnigentHealthPoll";

describe("createOmnigentHealthPoll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls /health and reports runner_online", async () => {
    const results: Array<Map<string, { runnerOnline: boolean }>> = [];
    const request = vi.fn(async () =>
      Response.json({
        sessions: { "s-1": { runner_online: true, host_online: null } },
      }),
    );
    const poll = createOmnigentHealthPoll(request, (map) =>
      results.push(new Map(map)),
    );

    poll.setSessionIds(["s-1"]);
    await vi.waitFor(() => expect(results.length).toBeGreaterThan(0));
    expect(results[0]?.get("s-1")).toEqual({ runnerOnline: true });
    expect(request).toHaveBeenCalledWith("/health?session_ids=s-1");
    poll.stop();
  });

  it("clears stale entries when the poll set becomes empty", async () => {
    const results: Array<Map<string, { runnerOnline: boolean }>> = [];
    const request = vi.fn(async () =>
      Response.json({ sessions: { "s-1": { runner_online: false } } }),
    );
    const poll = createOmnigentHealthPoll(request, (map) =>
      results.push(new Map(map)),
    );

    poll.setSessionIds(["s-1"]);
    await vi.waitFor(() => expect(results.some((m) => m.has("s-1"))).toBe(true));
    poll.setSessionIds([]);
    expect(results.at(-1)?.size).toBe(0);
    poll.stop();
  });

  it("backs off after failures up to POLL_MAX_MS", async () => {
    const request = vi.fn(async () => new Response("nope", { status: 500 }));
    const poll = createOmnigentHealthPoll(request, () => undefined);

    poll.setSessionIds(["s-1"]);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(POLL_OK_MS * 2);
    expect(request).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(POLL_OK_MS * 4);
    expect(request).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(POLL_MAX_MS);
    expect(request).toHaveBeenCalledTimes(4);
    poll.stop();
  });
});
