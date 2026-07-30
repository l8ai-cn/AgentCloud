import { beforeEach, describe, expect, it, vi } from "vitest";

const callAdminConnect = vi.fn();

vi.mock("./transport", () => ({
  callAdminConnect: (...args: unknown[]) => callAdminConnect(...args),
}));

import {
  disableUser,
  enableUser,
  grantAdmin,
  listUsers,
  revokeAdmin,
  unverifyUserEmail,
  verifyUserEmail,
} from "./users";

function protoUser(id: number) {
  return {
    id: BigInt(id),
    email: "user@example.com",
    username: "user",
    name: "User",
    avatarUrl: undefined,
    isActive: true,
    isSystemAdmin: false,
    isEmailVerified: true,
    lastLoginAt: undefined,
    createdAt: "2026-07-30T00:00:00Z",
    updatedAt: "2026-07-30T00:00:00Z",
  };
}

describe("admin users API", () => {
  beforeEach(() => callAdminConnect.mockReset());

  it("maps list pagination and user fields", async () => {
    callAdminConnect.mockResolvedValue({
      items: [protoUser(7)],
      total: 1n,
      page: 2,
      pageSize: 20,
      totalPages: 3,
    });

    const result = await listUsers({ search: "user", page: 2, page_size: 20 });

    expect(callAdminConnect).toHaveBeenCalledWith(
      "proto.admin.v1.AdminService",
      "ListUsers",
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ search: "user", page: 2, pageSize: 20 }),
    );
    expect(result).toMatchObject({
      total: 1,
      page: 2,
      page_size: 20,
      total_pages: 3,
      data: [{ id: 7, email: "user@example.com" }],
    });
  });

  it.each([
    ["DisableUser", disableUser],
    ["EnableUser", enableUser],
    ["GrantAdmin", grantAdmin],
    ["RevokeAdmin", revokeAdmin],
    ["VerifyUserEmail", verifyUserEmail],
    ["UnverifyUserEmail", unverifyUserEmail],
  ])("calls %s with a bigint user id", async (method, action) => {
    callAdminConnect.mockResolvedValue(protoUser(42));

    await action(42);

    expect(callAdminConnect).toHaveBeenCalledWith(
      "proto.admin.v1.AdminService",
      method,
      expect.anything(),
      expect.anything(),
      { userId: 42n },
    );
  });
});
