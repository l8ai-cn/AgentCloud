import { redirect } from "next/navigation";

export default async function MarketplaceDetailRoute({
  params,
}: {
  params: Promise<{ org: string; listingSlug: string }>;
}) {
  const { org } = await params;
  redirect(`/${org}/skills`);
}
