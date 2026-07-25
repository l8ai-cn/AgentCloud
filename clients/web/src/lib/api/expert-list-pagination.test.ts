import { beforeEach, describe, expect, it, vi } from "vitest";

const listExpertsForStatistics = vi.fn();

vi.mock("@/lib/api/expert-statistics-api", () => ({
  listExpertsForStatistics: (...args: unknown[]) =>
    listExpertsForStatistics(...args),
}));

import { fetchAllExperts } from "@/lib/api/expert-list-pagination";

describe("fetchAllExperts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads every page before returning statistics input", async () => {
    listExpertsForStatistics
      .mockResolvedValueOnce({
        experts: [{ slug: "alpha" }, { slug: "beta" }],
        total: 3,
        snapshotMaxId: 42,
      })
      .mockResolvedValueOnce({
        experts: [{ slug: "gamma" }],
        total: 3,
        snapshotMaxId: 42,
      });

    const experts = await fetchAllExperts("acme");

    expect(experts.map((expert) => expert.slug)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
    expect(listExpertsForStatistics).toHaveBeenNthCalledWith(1, {
      orgSlug: "acme",
      limit: 100,
      offset: 0,
      snapshotMaxId: undefined,
      signal: undefined,
    });
    expect(listExpertsForStatistics).toHaveBeenNthCalledWith(2, {
      orgSlug: "acme",
      limit: 100,
      offset: 2,
      snapshotMaxId: 42,
      signal: undefined,
    });
  });

  it("rejects partial pagination instead of returning incomplete statistics", async () => {
    listExpertsForStatistics.mockResolvedValue({
      experts: [],
      total: 2,
      snapshotMaxId: 42,
    });

    await expect(fetchAllExperts("acme")).rejects.toThrow(
      "Partner pagination stopped before all records were loaded.",
    );
  });

  it("rejects duplicate partners across pages", async () => {
    listExpertsForStatistics
      .mockResolvedValueOnce({
        experts: [{ slug: "alpha" }],
        total: 2,
        snapshotMaxId: 42,
      })
      .mockResolvedValueOnce({
        experts: [{ slug: "alpha" }],
        total: 2,
        snapshotMaxId: 42,
      });

    await expect(fetchAllExperts("acme")).rejects.toThrow(
      "Partner pagination returned duplicate slug: alpha",
    );
  });

  it("rejects a total that changes between pages", async () => {
    listExpertsForStatistics
      .mockResolvedValueOnce({
        experts: [{ slug: "alpha" }],
        total: 2,
        snapshotMaxId: 42,
      })
      .mockResolvedValueOnce({
        experts: [{ slug: "beta" }],
        total: 3,
        snapshotMaxId: 42,
      });

    await expect(fetchAllExperts("acme")).rejects.toThrow(
      "Partner list changed while statistics were loading.",
    );
  });

  it("rejects pages that cross snapshot boundaries", async () => {
    listExpertsForStatistics
      .mockResolvedValueOnce({
        experts: [{ slug: "alpha" }],
        total: 2,
        snapshotMaxId: 42,
      })
      .mockResolvedValueOnce({
        experts: [{ slug: "beta" }],
        total: 2,
        snapshotMaxId: 43,
      });

    await expect(fetchAllExperts("acme")).rejects.toThrow(
      "Partner pagination crossed snapshot boundaries.",
    );
  });
});
