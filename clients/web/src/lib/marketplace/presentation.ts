export function formatMarketplaceCredits(
  quota: { mode: string; estimated_credits_micro: string } | undefined,
): string | null {
  if (!quota || quota.mode !== "per_install") return null;
  try {
    const credits = BigInt(quota.estimated_credits_micro);
    const zero = BigInt(0);
    const scale = BigInt(1_000_000);
    if (credits <= zero) return null;
    const whole = credits / scale;
    const decimal = (credits % scale)
      .toString()
      .padStart(6, "0")
      .replace(/0+$/, "");
    return decimal ? `${whole}.${decimal}` : `${whole}`;
  } catch {
    return null;
  }
}

export function uniqueListingSpaces<T extends { slug: string }>(
  spaces: T[],
): T[] {
  return [...new Map(spaces.map((space) => [space.slug, space])).values()];
}
