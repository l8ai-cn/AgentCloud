import { beforeEach, describe, expect, it, vi } from "vitest";

const callAdminConnect = vi.fn();

vi.mock("./transport", () => ({
  callAdminConnect: (...args: unknown[]) => callAdminConnect(...args),
}));

import {
  deleteOrganization,
  getOrganizationMembers,
  listOrganizations,
} from "./organizations";

function protoOrganization(id: number) {
  return {
    id: BigInt(id),
    name: "Acme",
    slug: "acme",
    logoUrl: undefined,
    subscriptionPlan: "team",
    subscriptionStatus: "active",
    createdAt: "2026-07-30T00:00:00Z",
    updatedAt: "2026-07-30T00:00:00Z",
  };
}

describe("admin organizations API", () => {
  beforeEach(() => callAdminConnect.mockReset());

  it("maps organization pagination", async () => {
    callAdminConnect.mockResolvedValue({
      items: [protoOrganization(9)],
      total: 1n,
      page: 2,
      pageSize: 20,
      totalPages: 3,
    });

    const result = await listOrganizations({ search: "acme", page: 2, page_size: 20 });

    expect(callAdminConnect).toHaveBeenCalledWith(
      "proto.admin.v1.AdminService",
      "ListOrganizations",
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ search: "acme", page: 2, pageSize: 20 }),
    );
    expect(result).toMatchObject({
      total: 1,
      page: 2,
      page_size: 20,
      total_pages: 3,
      data: [{ id: 9, name: "Acme", logo_url: null }],
    });
  });

  it("maps nested member identity", async () => {
    callAdminConnect.mockResolvedValue({
      members: [{
        id: 5n,
        userId: 7n,
        orgId: 9n,
        role: "owner",
        joinedAt: "2026-07-30T00:00:00Z",
        user: {
          id: 7n,
          email: "owner@example.com",
          username: "owner",
          name: undefined,
          avatarUrl: undefined,
        },
      }],
    });

    const members = await getOrganizationMembers(9);

    expect(members).toEqual([expect.objectContaining({
      id: 5,
      user_id: 7,
      org_id: 9,
      user: expect.objectContaining({ id: 7, name: null, avatar_url: null }),
    })]);
  });

  it("deletes with a bigint organization id", async () => {
    callAdminConnect.mockResolvedValue({});

    await deleteOrganization(9);

    expect(callAdminConnect).toHaveBeenCalledWith(
      "proto.admin.v1.AdminService",
      "DeleteOrganization",
      expect.anything(),
      expect.anything(),
      { orgId: 9n },
    );
  });
});
