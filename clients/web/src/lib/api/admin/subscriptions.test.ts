import { beforeEach, describe, expect, it, vi } from "vitest";

const callAdminConnect = vi.fn();

vi.mock("./transport", () => ({
  callAdminConnect: (...args: unknown[]) => callAdminConnect(...args),
}));

import {
  getSubscription,
  listSubscriptionPlans,
  setSubscriptionQuota,
  updateSubscriptionSeats,
} from "./subscriptions";

function protoPlan() {
  return {
    id: 2n,
    name: "team",
    displayName: "Team",
    pricePerSeatMonthly: 20,
    pricePerSeatYearly: 200,
    includedPodMinutes: 1000,
    maxUsers: 50,
    maxRunners: 10,
    maxConcurrentPods: 5,
    maxRepositories: 20,
  };
}

function protoSubscription() {
  return {
    subscription: {
      id: 11n,
      organizationId: 9n,
      planId: 2n,
      status: "active",
      billingCycle: "monthly",
      currentPeriodStart: "2026-07-01T00:00:00Z",
      currentPeriodEnd: "2026-08-01T00:00:00Z",
      autoRenew: true,
      seatCount: 8,
      cancelAtPeriodEnd: false,
      plan: protoPlan(),
    },
    seatUsage: {
      totalSeats: 8,
      usedSeats: 3,
      availableSeats: 5,
      maxSeats: 50,
      canAddSeats: true,
    },
    customQuotasJson: '{"pod_minutes":2500}',
  };
}

describe("admin subscriptions API", () => {
  beforeEach(() => callAdminConnect.mockReset());

  it("maps subscription, plan, seats, and quotas", async () => {
    callAdminConnect.mockResolvedValue(protoSubscription());

    const result = await getSubscription(9);

    expect(result).toMatchObject({
      id: 11,
      organization_id: 9,
      plan: { id: 2, name: "team" },
      seat_usage: { used_seats: 3, available_seats: 5 },
      custom_quotas: { pod_minutes: 2500 },
    });
  });

  it("returns null when the organization has no subscription record", async () => {
    callAdminConnect.mockResolvedValue({});

    await expect(getSubscription(9)).resolves.toBeNull();
  });

  it("maps available plans", async () => {
    callAdminConnect.mockResolvedValue({ data: [protoPlan()] });

    const plans = await listSubscriptionPlans(9);

    expect(plans).toEqual([expect.objectContaining({
      id: 2,
      name: "team",
      max_concurrent_pods: 5,
    })]);
  });

  it.each([
    ["UpdateSeats", () => updateSubscriptionSeats(9, 12), { orgId: 9n, seatCount: 12 }],
    [
      "SetCustomQuota",
      () => setSubscriptionQuota(9, "pod_minutes", 2500),
      { orgId: 9n, resource: "pod_minutes", limit: 2500 },
    ],
  ])("calls %s with the expected contract", async (method, action, input) => {
    callAdminConnect.mockResolvedValue(protoSubscription());

    await action();

    expect(callAdminConnect).toHaveBeenCalledWith(
      "proto.billing.v1.SubscriptionAdminService",
      method,
      expect.anything(),
      expect.anything(),
      input,
    );
  });
});
