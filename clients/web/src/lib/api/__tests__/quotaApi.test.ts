import { beforeEach, describe, expect, it, vi } from "vitest";
import { getQuotaReport, upsertTokenQuota } from "../quotaApi";

vi.mock("@/lib/env", () => ({
  getApiBaseUrl: () => "http://localhost:10000/api",
}));

vi.mock("@/lib/wasm-core", () => ({
  getAuthManager: () => ({ get_token: () => "test-token" }),
}));

vi.mock("@/stores/auth", () => ({
  readCurrentOrg: () => ({ slug: "acme" }),
}));

describe("quotaApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the quota report without virtual-key fields", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        total_tokens: 12,
        total_cost_usd: 0,
        by_user: [],
        by_model: [],
        quotas: [],
      }), { status: 200 }),
    );

    await expect(getQuotaReport()).resolves.toMatchObject({
      total_tokens: 12,
      by_model: [],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:10000/api/v1/usage/quota-report",
      expect.any(Object),
    );
  });

  it("upserts token quotas", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    await upsertTokenQuota({
      user_id: null,
      model: "gpt-5.4",
      limit_tokens: 1000,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:10000/api/v1/token-quotas",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          user_id: null,
          model: "gpt-5.4",
          limit_tokens: 1000,
        }),
      }),
    );
  });
});
