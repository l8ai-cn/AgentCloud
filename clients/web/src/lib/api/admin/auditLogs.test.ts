import { beforeEach, describe, expect, it, vi } from "vitest";

const callAdminConnect = vi.fn();

vi.mock("./transport", () => ({
  callAdminConnect: (...args: unknown[]) => callAdminConnect(...args),
}));

import { listAuditLogs } from "./auditLogs";

const SERVICE = "proto.admin.v1.AdminService";

function protoAuditLog() {
  return {
    id: 11n,
    adminUserId: 5n,
    action: "disable_user",
    targetType: "user",
    targetId: 9n,
    oldData: '{"is_active":true}',
    newData: '{"is_active":false}',
    ipAddress: "10.0.0.1",
    userAgent: "vitest-agent",
    createdAt: "2026-07-30T00:00:00Z",
    adminUser: {
      id: 5n,
      email: "admin@example.com",
      username: "admin",
      name: "Admin",
      avatarUrl: "https://cdn.example.com/admin.png",
    },
  };
}

function protoAuditLogWithoutOptionals() {
  return {
    id: 12n,
    adminUserId: 6n,
    action: "grant_admin",
    targetType: "user",
    targetId: 10n,
    oldData: undefined,
    newData: undefined,
    ipAddress: undefined,
    userAgent: undefined,
    createdAt: "2026-07-31T00:00:00Z",
    adminUser: undefined,
  };
}

function page(items: unknown[]) {
  return { items, total: BigInt(items.length), page: 1, pageSize: 20, totalPages: 1 };
}

describe("admin audit logs API", () => {
  beforeEach(() => callAdminConnect.mockReset());

  it("maps list pagination and audit log fields", async () => {
    callAdminConnect.mockResolvedValue({
      items: [protoAuditLog()],
      total: 3n,
      page: 2,
      pageSize: 20,
      totalPages: 5,
    });

    const result = await listAuditLogs({ page: 2, page_size: 20 });

    expect(result).toEqual({
      total: 3,
      page: 2,
      page_size: 20,
      total_pages: 5,
      data: [
        {
          id: 11,
          admin_user_id: 5,
          action: "disable_user",
          target_type: "user",
          target_id: 9,
          old_data: '{"is_active":true}',
          new_data: '{"is_active":false}',
          ip_address: "10.0.0.1",
          user_agent: "vitest-agent",
          created_at: "2026-07-30T00:00:00Z",
          admin_user: {
            id: 5,
            email: "admin@example.com",
            username: "admin",
            name: "Admin",
            avatar_url: "https://cdn.example.com/admin.png",
          },
        },
      ],
    });
  });

  it("maps absent optional fields to null and omits a missing admin user", async () => {
    callAdminConnect.mockResolvedValue(page([protoAuditLogWithoutOptionals()]));

    const result = await listAuditLogs();

    expect(result.data[0]).toMatchObject({
      old_data: null,
      new_data: null,
      ip_address: null,
      user_agent: null,
    });
    expect(result.data[0].admin_user).toBeUndefined();
  });

  it("translates every filter into its camelCase request field", async () => {
    callAdminConnect.mockResolvedValue(page([]));

    await listAuditLogs({
      admin_user_id: 5,
      action: "disable_user",
      target_type: "user",
      target_id: 9,
      start_time: "2026-07-01T00:00:00Z",
      end_time: "2026-07-31T00:00:00Z",
      page: 3,
      page_size: 50,
    });

    expect(callAdminConnect).toHaveBeenCalledWith(
      SERVICE,
      "ListAuditLogs",
      expect.anything(),
      expect.anything(),
      {
        adminUserId: 5n,
        action: "disable_user",
        targetType: "user",
        targetId: 9n,
        startTime: "2026-07-01T00:00:00Z",
        endTime: "2026-07-31T00:00:00Z",
        page: 3,
        pageSize: 50,
      },
    );
  });

  it("sends an unfiltered request when no params are supplied", async () => {
    callAdminConnect.mockResolvedValue(page([]));

    await listAuditLogs();

    expect(callAdminConnect).toHaveBeenCalledWith(
      SERVICE,
      "ListAuditLogs",
      expect.anything(),
      expect.anything(),
      {
        adminUserId: undefined,
        action: undefined,
        targetType: undefined,
        targetId: undefined,
        startTime: undefined,
        endTime: undefined,
        page: undefined,
        pageSize: undefined,
      },
    );
  });

  it("keeps zero ids as filters instead of dropping them", async () => {
    callAdminConnect.mockResolvedValue(page([]));

    await listAuditLogs({ admin_user_id: 0, target_id: 0 });

    expect(callAdminConnect).toHaveBeenCalledWith(
      SERVICE,
      "ListAuditLogs",
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ adminUserId: 0n, targetId: 0n }),
    );
  });

  it("propagates transport failures to the caller", async () => {
    callAdminConnect.mockRejectedValueOnce(new Error("permission denied"));

    await expect(listAuditLogs({ page: 1 })).rejects.toThrow("permission denied");
  });
});
