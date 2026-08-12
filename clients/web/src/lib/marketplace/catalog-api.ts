import { marketplaceRequest } from "./client";

export const DEFAULT_MARKET_SLUG = "agent-cloud-market";

export type MarketplaceResourceType =
  | "application"
  | "skill"
  | "mcp_connector"
  | "resource";

export interface MarketplaceSpace {
  slug: string;
  name: string;
}

export interface MarketplaceListingSummary {
  listing_id: string;
  listing_version_id: string;
  slug: string;
  resource_type: MarketplaceResourceType;
  display_name: string;
  tagline: string;
  publisher: {
    display_name: string;
    verified: boolean;
  };
  spaces: MarketplaceSpace[];
  quota?: {
    mode: string;
    estimated_credits_micro: string;
  };
}

export interface MarketplaceListingDetail extends MarketplaceListingSummary {
  agent_slug: string;
  description: string;
  outcomes: string[];
  use_cases: string[];
  target_audience: string[];
  requirements: string[];
  permissions: string[];
  version: string;
  release_notes: string;
  documentation_url?: string;
  support_url?: string;
}

export interface MarketplaceSummary {
  name: string;
  summary: string;
}

export interface MarketplaceListingFilters {
  type?: MarketplaceResourceType;
  space?: string;
}

export function fetchMarketplaceSummary(): Promise<MarketplaceSummary> {
  return marketplaceRequest(`/markets/${DEFAULT_MARKET_SLUG}`);
}

export async function fetchMarketplaceListings(
  filters: MarketplaceListingFilters = {},
): Promise<MarketplaceListingSummary[]> {
  const params = new URLSearchParams();
  params.set("type", filters.type ?? "application");
  if (filters.space) params.set("space", filters.space);
  const response = await marketplaceRequest<{ items: MarketplaceListingSummary[] }>(
    `/markets/${DEFAULT_MARKET_SLUG}/listings?${params.toString()}`,
  );
  return response.items;
}

export function applicationListings(
  items: MarketplaceListingSummary[],
): MarketplaceListingSummary[] {
  return items.filter((item) => item.resource_type === "application");
}

export function fetchMarketplaceListingDetail(
  listingSlug: string,
): Promise<MarketplaceListingDetail> {
  return marketplaceRequest(
    `/markets/${DEFAULT_MARKET_SLUG}/listings/${encodeURIComponent(listingSlug)}`,
  );
}
