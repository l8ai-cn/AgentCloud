import {
  parseOmnigentMessageContent,
} from "./omnigentMessageContent";
import type { OmnigentMessageContentBlock } from "./omnigentMessageContent";

/**
 * A committed history item from `GET /v1/sessions/{id}/items`, flattened
 * (`{id, type, status, response_id, ...fields}`).
 *
 * Only the message shape is modelled; other item types are carried as
 * `OmnigentUnmodelledItem` so history pagination stays lossless in position
 * while the features that render them land.
 */

export interface OmnigentMessageHistoryItem {
  id: string;
  type: "message";
  role: "user" | "assistant" | "system";
  content: OmnigentMessageContentBlock[];
  turnId: string;
  isMeta: boolean;
  createdBy?: string;
}

export interface OmnigentUnmodelledItem {
  id: string;
  type: "unmodelled";
  itemType: string;
  turnId: string;
}

export type OmnigentHistoryItem =
  | OmnigentMessageHistoryItem
  | OmnigentUnmodelledItem;

export function parseOmnigentHistoryItem(raw: unknown): OmnigentHistoryItem | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const id = record.id;
  if (typeof id !== "string" || id === "") return null;
  const itemType = String(record.type ?? "");
  const turnId = String(record.response_id ?? "");

  if (itemType === "message") {
    return {
      id,
      type: "message",
      role: parseRole(record.role),
      content: parseOmnigentMessageContent(record.content),
      turnId,
      isMeta: record.is_meta === true,
      ...(typeof record.created_by === "string"
        ? { createdBy: record.created_by }
        : {}),
    };
  }
  return { id, type: "unmodelled", itemType, turnId };
}

function parseRole(raw: unknown): "user" | "assistant" | "system" {
  return raw === "user" || raw === "system" ? raw : "assistant";
}
