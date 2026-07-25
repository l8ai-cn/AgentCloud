export interface MentionState {
  query: string;
  start: number;
  end: number;
}

const MENTION_RE = /(?:^|\s)@([^\s@]*)$/;

export function detectMentionAt(
  text: string,
  caret: number,
): MentionState | null {
  const before = text.slice(0, caret);
  const m = MENTION_RE.exec(before);
  if (!m) return null;
  const query = m[1] ?? "";
  return { query, start: caret - query.length - 1, end: caret };
}

export function parseMentionToken(query: string): {
  dir: string;
  filter: string;
} {
  const slash = query.lastIndexOf("/");
  return slash >= 0
    ? { dir: query.slice(0, slash), filter: query.slice(slash + 1) }
    : { dir: "", filter: query };
}
