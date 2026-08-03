import { redirect } from "next/navigation";

export default async function MarketplaceAcquireRoute({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ listing?: string | string[] }>;
}) {
  const { org } = await params;
  const query = await searchParams;
  const listing = Array.isArray(query.listing) ? query.listing[0] : query.listing;
  redirect(
    listing
      ? `/${org}/marketplace/${encodeURIComponent(listing)}`
      : `/${org}/marketplace`,
  );
}
