import { Folder, File } from "lucide-react";

import type { WorkspaceFileEntry } from "./workspaceFileSource";

export function MentionMenu({
  entries,
  selectedIndex,
  onSelect,
  onOpenDir,
}: {
  entries: readonly WorkspaceFileEntry[];
  selectedIndex: number;
  onSelect: (path: string, isDir: boolean) => void;
  onOpenDir: (path: string) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <ul
      className="absolute inset-x-0 bottom-full z-20 mb-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md"
      role="listbox"
    >
      {entries.map((entry, index) => {
        const selected = index === selectedIndex;
        const isDir = entry.type === "directory";
        return (
          <li key={`${entry.type}:${entry.path}`} role="option" aria-selected={selected}>
            <button
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${
                selected ? "bg-accent text-accent-foreground" : ""
              }`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                isDir ? onOpenDir(entry.path) : onSelect(entry.path, false)
              }
              type="button"
            >
              {isDir ? (
                <Folder className="size-3.5 shrink-0" />
              ) : (
                <File className="size-3.5 shrink-0" />
              )}
              <span className="truncate">{entry.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
