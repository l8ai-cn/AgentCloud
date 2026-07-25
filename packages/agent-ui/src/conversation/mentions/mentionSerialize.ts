import { nativeCodingAgentForHarness } from "./nativeCodingAgent";

export interface MentionItem {
  path: string;
  isDir: boolean;
  lineRange?: { start: number; end: number };
}

export function mentionItemKey(item: MentionItem): string {
  const range = item.lineRange
    ? `${item.lineRange.start}-${item.lineRange.end}`
    : "";
  return `${item.path}|${item.isDir ? "1" : "0"}|${range}`;
}

export function mentionItemPath(item: MentionItem): string {
  if (item.lineRange) {
    return `${item.path}:${item.lineRange.start}-${item.lineRange.end}`;
  }
  return item.isDir ? `${item.path}/` : item.path;
}

export function mentionMarkerFor(
  harness: string | null,
  path: string,
): string {
  return nativeCodingAgentForHarness(harness)?.key === "codex"
    ? `[Attached file: ${path}]`
    : `[Attached: ${path}]`;
}

export function buildMentionPreamble(
  items: readonly MentionItem[],
  harness: string | null,
): string {
  if (items.length === 0) return "";
  return (
    items.map((i) => mentionMarkerFor(harness, mentionItemPath(i))).join("\n") +
    "\n\n"
  );
}
