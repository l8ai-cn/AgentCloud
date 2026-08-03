import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { redirect } from "next/navigation";
import MarketplaceDetailRoute from "./[listingSlug]/page";
import MarketplaceRoute from "./page";

describe("organization marketplace routes", () => {
  beforeEach(() => {
    vi.mocked(redirect).mockClear();
  });

  it("redirects the catalog to Skill 市场 while marketplace API is retired", async () => {
    await MarketplaceRoute({ params: Promise.resolve({ org: "dev-org" }) });
    expect(redirect).toHaveBeenCalledWith("/dev-org/skills");
  });

  it("redirects listing details to Skill 市场", async () => {
    await MarketplaceDetailRoute({
      params: Promise.resolve({ org: "dev-org", listingSlug: "software-delivery-expert" }),
    });
    expect(redirect).toHaveBeenCalledWith("/dev-org/skills");
  });
});
