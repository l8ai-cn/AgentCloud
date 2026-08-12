import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";

import { MarketplaceCatalogPage } from "./MarketplaceCatalogPage";
import type { MarketplaceListingSummary } from "@/lib/marketplace/catalog-api";

const replace = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/dev-org/marketplace",
  useSearchParams: () => new URLSearchParams(search),
}));

vi.mock("@/lib/marketplace/catalog-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/marketplace/catalog-api")>(
    "@/lib/marketplace/catalog-api",
  );
  return {
    ...actual,
    fetchMarketplaceSummary: vi.fn(),
    fetchMarketplaceListings: vi.fn(),
  };
});

import {
  fetchMarketplaceListings,
  fetchMarketplaceSummary,
} from "@/lib/marketplace/catalog-api";

describe("MarketplaceCatalogPage", () => {
  beforeEach(() => {
    search = "";
    replace.mockReset();
    vi.mocked(fetchMarketplaceSummary).mockResolvedValue({
      name: "Agent Cloud Application Market",
      summary: "Partner applications for this organization.",
    });
    vi.mocked(fetchMarketplaceListings).mockResolvedValue([
      listing("delivery", "application", "software-delivery", "Delivery partner"),
      listing("review-skill", "skill", "software-delivery", "Hidden skill"),
      listing("course-builder", "application", "education", "Course partner"),
    ]);
  });

  it("requests application listings and hides other resource types", async () => {
    render(<MarketplaceCatalogPage orgSlug="dev-org" />);

    await waitFor(() => {
      expect(fetchMarketplaceListings).toHaveBeenCalledWith({ type: "application" });
    });
    expect(await screen.findByRole("heading", { name: "Delivery partner" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Course partner" })).toBeInTheDocument();
    expect(screen.queryByText("Hidden skill")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Skill" })).not.toBeInTheDocument();
  });

  it("writes the selected space into the catalog URL", async () => {
    const user = userEvent.setup();
    render(<MarketplaceCatalogPage orgSlug="dev-org" />);

    await user.click(await screen.findByRole("button", { name: "education" }));

    expect(replace).toHaveBeenCalledWith(
      "/dev-org/marketplace?space=education",
      { scroll: false },
    );
  });
});

function listing(
  slug: string,
  resource_type: MarketplaceListingSummary["resource_type"],
  space: string,
  display_name: string,
): MarketplaceListingSummary {
  return {
    listing_id: slug,
    listing_version_id: "1",
    slug,
    resource_type,
    display_name,
    tagline: display_name,
    publisher: { display_name: "Agent Cloud", verified: false },
    spaces: [{ slug: space, name: space }],
  };
}
