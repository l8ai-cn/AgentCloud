import { describe, expect, it } from "vitest";

import type { MarketplaceListingSummary } from "./catalog-api";
import { filterCatalogListings, marketplaceSpaceHref } from "./catalog-listing-filter";

const delivery = listing("delivery", "application", "software-delivery");
const skill = listing("review-skill", "skill", "software-delivery");
const course = listing("course-builder", "application", "education");

describe("catalog listing filter", () => {
  it("drops non-application listings even when the API returns mixed types", () => {
    expect(filterCatalogListings([delivery, skill, course], "", "")).toEqual([delivery, course]);
  });

  it("filters partner applications by space slug", () => {
    expect(filterCatalogListings([delivery, course], "", "education")).toEqual([course]);
  });

  it("writes space into the catalog query string and clears it for all spaces", () => {
    const params = new URLSearchParams("q=delivery");
    expect(marketplaceSpaceHref("/dev-org/marketplace", params, "education"))
      .toBe("/dev-org/marketplace?q=delivery&space=education");
    expect(marketplaceSpaceHref("/dev-org/marketplace", new URLSearchParams("space=education"), ""))
      .toBe("/dev-org/marketplace");
  });
});

function listing(
  slug: string,
  resource_type: MarketplaceListingSummary["resource_type"],
  space: string,
): MarketplaceListingSummary {
  return {
    listing_id: slug,
    listing_version_id: "1",
    slug,
    resource_type,
    display_name: slug,
    tagline: slug,
    publisher: { display_name: "Agent Cloud", verified: true },
    spaces: [{ slug: space, name: space }],
  };
}
