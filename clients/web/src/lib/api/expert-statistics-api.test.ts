import { describe, expect, it, vi } from "vitest";

const lightFetch = vi.fn();

vi.mock("@/lib/light-auth/api-fetch", () => ({
  lightFetch: (...args: unknown[]) => lightFetch(...args),
}));

import { listExpertsForStatistics } from "@/lib/api/expert-statistics-api";

describe("listExpertsForStatistics", () => {
  it("binds pagination to the organization and snapshot boundary", async () => {
    const controller = new AbortController();
    lightFetch.mockResolvedValue({
      experts: [],
      total: 0,
      snapshot_max_id: 42,
    });

    const page = await listExpertsForStatistics({
      orgSlug: "acme",
      limit: 100,
      offset: 100,
      snapshotMaxId: 42,
      signal: controller.signal,
    });

    expect(page.snapshotMaxId).toBe(42);
    expect(lightFetch).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/experts",
      {
        authenticated: true,
        query: { limit: 100, offset: 100, snapshot_max_id: 42 },
        signal: controller.signal,
      },
    );
  });
});
