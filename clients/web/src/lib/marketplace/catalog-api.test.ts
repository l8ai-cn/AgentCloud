import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applicationListings,
  fetchMarketplaceListingDetail,
  fetchMarketplaceListings,
} from "./catalog-api";

describe("marketplace catalog API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("requests listings filtered to partner applications", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await fetchMarketplaceListings();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/marketplace/v1/markets/agent-cloud-market/listings?type=application"),
      expect.objectContaining({
        headers: expect.not.objectContaining({ Authorization: expect.anything() }),
      }),
    );
  });

  it("keeps only application listings when the catalog returns mixed types", () => {
    expect(applicationListings([
      { resource_type: "application", slug: "delivery" },
      { resource_type: "skill", slug: "review" },
      { resource_type: "mcp_connector", slug: "github" },
    ] as never)).toEqual([
      { resource_type: "application", slug: "delivery" },
    ]);
  });

  it("encodes a listing slug before requesting its detail", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ slug: "delivery" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await fetchMarketplaceListingDetail("delivery tools");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/listings/delivery%20tools"),
      expect.anything(),
    );
  });
});
