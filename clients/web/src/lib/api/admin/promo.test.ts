import { beforeEach, describe, expect, it, vi } from "vitest";

const callAdminConnect = vi.fn();

vi.mock("./transport", () => ({
  callAdminConnect: (...args: unknown[]) => callAdminConnect(...args),
}));

import {
  activatePromoCode,
  createPromoCode,
  deletePromoCode,
  getPromoCode,
  listPromoCodeRedemptions,
  listPromoCodes,
  updatePromoCode,
} from "./promo";

function protoPromoCode(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    code: "LAUNCH30",
    name: "Launch",
    description: "Launch campaign",
    type: "campaign",
    planName: "pro",
    durationMonths: 3,
    maxUses: 100,
    usedCount: 4,
    maxUsesPerOrg: 1,
    startsAt: "2026-07-01T00:00:00Z",
    expiresAt: "2026-09-01T00:00:00Z",
    isActive: true,
    createdById: 7n,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-02T00:00:00Z",
    ...overrides,
  };
}

describe("promo admin API", () => {
  beforeEach(() => {
    callAdminConnect.mockReset();
  });

  it("lists promo codes with all backend filters and pagination", async () => {
    callAdminConnect.mockResolvedValue({
      data: [protoPromoCode()],
      total: 21n,
      page: 2,
      pageSize: 20,
      totalPages: 2,
    });

    const result = await listPromoCodes({
      search: "launch",
      type: "campaign",
      plan_name: "pro",
      is_active: true,
      page: 2,
      page_size: 20,
    });

    expect(callAdminConnect.mock.calls[0][1]).toBe("ListPromoCodes");
    expect(callAdminConnect.mock.calls[0][4]).toEqual({
      type: "campaign",
      planName: "pro",
      isActive: true,
      search: "launch",
      page: 2,
      pageSize: 20,
    });
    expect(result).toMatchObject({
      total: 21,
      page: 2,
      page_size: 20,
      total_pages: 2,
    });
    expect(result.data[0]).toMatchObject({
      id: 1,
      code: "LAUNCH30",
      max_uses: 100,
      created_by_id: 7,
    });
  });

  it("gets and creates promo codes using the generated contract", async () => {
    callAdminConnect.mockResolvedValue(protoPromoCode({ id: 9n }));
    expect((await getPromoCode(9)).id).toBe(9);
    expect(callAdminConnect.mock.calls[0][4]).toEqual({ id: 9n });

    await createPromoCode({
      code: "PARTNER",
      name: "Partner launch",
      type: "partner",
      plan_name: "enterprise",
      duration_months: 6,
      max_uses_per_org: 2,
    });
    expect(callAdminConnect.mock.calls[1][1]).toBe("CreatePromoCode");
    expect(callAdminConnect.mock.calls[1][4]).toMatchObject({
      code: "PARTNER",
      description: "",
      planName: "enterprise",
      durationMonths: 6,
      maxUsesPerOrg: 2,
    });
  });

  it("distinguishes clearing expiration from leaving it unchanged", async () => {
    callAdminConnect.mockResolvedValue(protoPromoCode());

    await updatePromoCode(1, { name: "Renamed" });
    expect(callAdminConnect.mock.calls[0][4]).toMatchObject({
      id: 1n,
      clearExpiresAt: false,
      expiresAt: undefined,
    });

    await updatePromoCode(1, { expires_at: "" });
    expect(callAdminConnect.mock.calls[1][4]).toMatchObject({
      id: 1n,
      clearExpiresAt: true,
      expiresAt: undefined,
    });
  });

  it("runs lifecycle and delete procedures without swallowing errors", async () => {
    callAdminConnect.mockResolvedValueOnce({ message: "activated" });
    await expect(activatePromoCode(3)).resolves.toEqual({ message: "activated" });
    expect(callAdminConnect.mock.calls[0][1]).toBe("ActivatePromoCode");

    callAdminConnect.mockRejectedValueOnce(new Error("has redemptions"));
    await expect(deletePromoCode(3)).rejects.toThrow("has redemptions");
  });

  it("maps redemption display fields without fabricating entities", async () => {
    callAdminConnect.mockResolvedValue({
      data: [
        {
          id: 11n,
          promoCodeId: 1n,
          organizationId: 2n,
          userId: 3n,
          planName: "pro",
          durationMonths: 3,
          newPeriodEnd: "2026-12-01T00:00:00Z",
          createdAt: "2026-08-01T00:00:00Z",
          userEmail: "admin@example.com",
          userUsername: "admin",
          organizationName: "Agent Cloud",
          organizationSlug: "agent-cloud",
        },
      ],
      total: 1n,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    const result = await listPromoCodeRedemptions(1, {
      page: 1,
      page_size: 20,
    });
    expect(result.data[0]).toEqual({
      id: 11,
      promo_code_id: 1,
      organization_id: 2,
      organization_name: "Agent Cloud",
      organization_slug: "agent-cloud",
      user_id: 3,
      user_email: "admin@example.com",
      user_username: "admin",
      plan_name: "pro",
      duration_months: 3,
      new_period_end: "2026-12-01T00:00:00Z",
      ip_address: null,
      created_at: "2026-08-01T00:00:00Z",
    });
  });

  it("rejects unsupported promo-code types from the server", async () => {
    callAdminConnect.mockResolvedValue({
      data: [protoPromoCode({ type: "unknown" })],
      total: 1n,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    await expect(listPromoCodes()).rejects.toThrow(
      "Unsupported promo code type: unknown",
    );
  });
});
