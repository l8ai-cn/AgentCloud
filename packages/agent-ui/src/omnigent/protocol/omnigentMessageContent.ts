export type OmnigentMessageContentBlock =
  | { type: "input_text"; text: string }
  | { type: "input_image"; file_id: string; filename?: string }
  | { type: "input_file"; file_id: string; filename?: string }
  | { type: "output_text"; text: string };

export function parseOmnigentMessageContent(
  raw: unknown,
): OmnigentMessageContentBlock[] {
  if (!Array.isArray(raw)) return [];
  const blocks: OmnigentMessageContentBlock[] = [];
  for (const entry of raw) {
    const block = parseContentBlock(entry);
    if (block !== null) blocks.push(block);
  }
  return blocks;
}

export function omnigentContentText(
  content: readonly OmnigentMessageContentBlock[],
): string {
  return content
    .map((block) =>
      block.type === "input_text" || block.type === "output_text"
        ? block.text
        : "",
    )
    .join("");
}

function parseContentBlock(entry: unknown): OmnigentMessageContentBlock | null {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return null;
  }
  const record = entry as Record<string, unknown>;
  const type = record.type;
  if (type === "input_text" || type === "output_text") {
    return typeof record.text === "string"
      ? { type, text: record.text }
      : null;
  }
  if (type === "input_image" || type === "input_file") {
    if (typeof record.file_id !== "string") return null;
    return typeof record.filename === "string"
      ? { type, file_id: record.file_id, filename: record.filename }
      : { type, file_id: record.file_id };
  }
  return null;
}
