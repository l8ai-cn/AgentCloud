import { beforeEach, describe, expect, it, vi } from "vitest";

const callAdminConnect = vi.fn();

vi.mock("./transport", () => ({
  callAdminConnect: (...args: unknown[]) => callAdminConnect(...args),
}));

import {
  approveExpertRelease,
  listExpertReleases,
  rejectExpertRelease,
} from "./expertMarket";

const release = {
  id: 7n,
  applicationSlug: "video-expert",
  version: 3,
  status: "pending",
  name: "Video Expert",
  summary: "Summary",
  description: "Description",
  category: "media",
  tags: ["video"],
  outcomes: ["render"],
  featured: false,
  expertSnapshotJson: "{}",
  workerSpecSnapshotJson: "{}",
  skillDependenciesJson: "[]",
  createdAt: "2026-07-30T00:00:00Z",
};

describe("admin expert market API", () => {
  beforeEach(() => callAdminConnect.mockReset());

  it("maps list pagination and release fields", async () => {
    callAdminConnect.mockResolvedValue({
      items: [release],
      total: 1n,
      limit: 20,
      offset: 0,
    });

    const result = await listExpertReleases("pending");

    expect(result).toMatchObject({
      total: 1,
      data: [{ id: 7, application_slug: "video-expert", status: "pending" }],
    });
  });

  it("approves with a bigint release id", async () => {
    callAdminConnect.mockResolvedValue({ ...release, status: "published" });

    await approveExpertRelease(7);

    expect(callAdminConnect.mock.calls[0][4]).toEqual({ releaseId: 7n });
  });

  it("rejects with a reason", async () => {
    callAdminConnect.mockResolvedValue({ ...release, status: "rejected" });

    await rejectExpertRelease(7, "Missing dependency evidence");

    expect(callAdminConnect.mock.calls[0][4]).toEqual({
      releaseId: 7n,
      reason: "Missing dependency evidence",
    });
  });
});
