import {
  applicationListings,
  type MarketplaceListingSummary,
} from "./catalog-api";

export function filterCatalogListings(
  listings: MarketplaceListingSummary[],
  query: string,
  space: string,
): MarketplaceListingSummary[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return applicationListings(listings).filter((item) => {
    const text = [
      item.display_name,
      item.tagline,
      item.publisher.display_name,
      ...item.spaces.map((itemSpace) => itemSpace.name),
    ]
      .join(" ")
      .toLocaleLowerCase();
    return (
      (!normalizedQuery || text.includes(normalizedQuery)) &&
      (!space || item.spaces.some((itemSpace) => itemSpace.slug === space))
    );
  });
}

export function marketplaceSpaceHref(
  pathname: string,
  searchParams: URLSearchParams,
  space: string,
): string {
  const params = new URLSearchParams(searchParams.toString());
  if (space) params.set("space", space);
  else params.delete("space");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
