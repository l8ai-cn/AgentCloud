"use client";

import { cn } from "@/lib/utils";

export type FilterType = "running" | "stopped";

interface WorkspaceFiltersProps {
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  t: (key: string) => string;
}

export function WorkspaceFilters({ filter, onFilterChange, t }: WorkspaceFiltersProps) {
  const filters: FilterType[] = ["running", "stopped"];

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-surface-muted/30">
      {filters.map((f) => (
        <button
          key={f}
          className={cn(
            "px-2 py-1 text-xs rounded transition-colors",
            filter === f
              ? "bg-muted text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground motion-interactive hover:bg-surface-muted"
          )}
          onClick={() => onFilterChange(f)}
        >
          {t(`workspace.filters.${f}`)}
        </button>
      ))}
    </div>
  );
}
