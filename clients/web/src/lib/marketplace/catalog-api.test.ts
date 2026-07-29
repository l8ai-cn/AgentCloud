import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchMarketplaceListingDetail, fetchMarketplaceListings } from "./catalog-api";

describe("marketplace catalog API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("reads the catalog through the same-origin marketplace API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await fetchMarketplaceListings();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/marketplace/v1/markets/agent-cloud-market/listings"),
      expect.objectContaining({
        headers: expect.not.objectContaining({ Authorization: expect.anything() }),
      }),
    );
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
