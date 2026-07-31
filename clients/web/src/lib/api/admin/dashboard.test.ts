import { beforeEach, describe, expect, it, vi } from "vitest";

const callAdminConnect = vi.fn();

vi.mock("./transport", () => ({
  callAdminConnect: (...args: unknown[]) => callAdminConnect(...args),
}));

import { getDashboardStats } from "./dashboard";

const SERVICE = "proto.admin.v1.AdminService";

const protoStats = {
  totalUsers: 1200n,
  activeUsers: 900n,
  totalOrganizations: 87n,
  totalRunners: 42n,
  onlineRunners: 30n,
  totalPods: 510n,
  activePods: 64n,
  totalSubscriptions: 25n,
  activeSubscriptions: 21n,
  newUsersToday: 7n,
  newUsersThisWeek: 35n,
  newUsersThisMonth: 140n,
};

describe("admin dashboard API", () => {
  beforeEach(() => callAdminConnect.mockReset());

  it("requests GetDashboardStats with an empty payload", async () => {
    callAdminConnect.mockResolvedValue(protoStats);

    await getDashboardStats();

    expect(callAdminConnect).toHaveBeenCalledWith(
      SERVICE,
      "GetDashboardStats",
      expect.anything(),
      expect.anything(),
      {},
    );
  });

  it("maps every bigint counter to a snake_case number", async () => {
    callAdminConnect.mockResolvedValue(protoStats);

    const result = await getDashboardStats();

    expect(result).toEqual({
      total_users: 1200,
      active_users: 900,
      total_organizations: 87,
      total_runners: 42,
      online_runners: 30,
      total_pods: 510,
      active_pods: 64,
      total_subscriptions: 25,
      active_subscriptions: 21,
      new_users_today: 7,
      new_users_this_week: 35,
      new_users_this_month: 140,
    });
  });

  it("propagates transport failures to the caller", async () => {
    callAdminConnect.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(getDashboardStats()).rejects.toThrow("database unavailable");
  });
});
