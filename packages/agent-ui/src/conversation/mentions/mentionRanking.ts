export const MENTION_MATCH_CAP = 50;

export function rankMentionEntries<T extends { name: string; type: string }>(
  entries: readonly T[],
  filter: string,
  cap = MENTION_MATCH_CAP,
): T[] {
  const needle = filter.toLowerCase();
  return entries
    .filter((e) => e.name.toLowerCase().includes(needle))
    .sort((a, b) =>
      a.type !== b.type
        ? a.type === "directory"
          ? -1
          : 1
        : a.name.localeCompare(b.name),
    )
    .slice(0, cap);
}
