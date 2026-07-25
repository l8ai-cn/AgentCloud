import type { WorkspaceFileEntry } from "./workspaceFileSource";

export function parseWorkspaceFileList(body: unknown): WorkspaceFileEntry[] {
  if (!body || typeof body !== "object") return [];
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  const out: WorkspaceFileEntry[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const name = (row as { name?: unknown }).name;
    const path = (row as { path?: unknown }).path;
    const type = (row as { type?: unknown }).type;
    if (typeof name !== "string" || typeof path !== "string") continue;
    if (type !== "file" && type !== "directory") continue;
    out.push({ name, path, type });
  }
  return out;
}
