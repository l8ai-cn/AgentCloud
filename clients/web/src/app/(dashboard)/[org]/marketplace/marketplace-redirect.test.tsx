import { describe, expect, it, vi } from "vitest";

import MarketplaceDetailRoute from "./[listingSlug]/page";
import MarketplaceRoute from "./page";

vi.mock("@/components/marketplace/MarketplaceCatalogPage", () => ({
  MarketplaceCatalogPage: ({ orgSlug }: { orgSlug: string }) => ({ type: "catalog", orgSlug }),
}));

vi.mock("@/components/marketplace/MarketplaceDetailPage", () => ({
  MarketplaceDetailPage: ({
    orgSlug,
    listingSlug,
  }: {
    orgSlug: string;
    listingSlug: string;
  }) => ({
    type: "detail",
    orgSlug,
    listingSlug,
  }),
}));

describe("organization marketplace in-product routes", () => {
  it("renders the catalog inside the organization frontend", async () => {
    const result = await MarketplaceRoute({ params: Promise.resolve({ org: "dev-org" }) });

    expect(result.props).toMatchObject({ orgSlug: "dev-org" });
  });

  it("renders listing details inside the organization frontend", async () => {
    const result = await MarketplaceDetailRoute({
      params: Promise.resolve({ org: "dev-org", listingSlug: "software-delivery-expert" }),
    });

    expect(result.props).toMatchObject({
      orgSlug: "dev-org",
      listingSlug: "software-delivery-expert",
    });
  });
});
