import { redirect } from "next/navigation";

export default async function MarketplaceAcquireRoute({
  params,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ listing?: string | string[] }>;
}) {
  const { org } = await params;
  redirect(`/${org}/skills`);
}
