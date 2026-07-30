"use client";

import { Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { ExpertRelease } from "@/lib/api/admin/expertMarket";

export function ExpertReleaseList({
  releases,
  loading,
  onSelect,
}: {
  releases: ExpertRelease[];
  loading: boolean;
  onSelect: (id: number) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-1 rounded-md border border-border p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-md bg-surface-muted" />
        ))}
      </div>
    );
  }
  if (!releases.length) {
    return <EmptyState size="compact" title="No releases in this state" />;
  }
  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface-raised">
      {releases.map((release) => (
        <div
          key={release.id}
          className="grid gap-3 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_auto] md:items-center"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium">{release.name}</p>
              <Badge variant="outline">v{release.version}</Badge>
              <Badge variant={release.status === "pending" ? "warning" : "secondary"}>
                {release.status}
              </Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">{release.summary}</p>
          </div>
          <div className="text-xs text-muted-foreground">
            <p>{release.application_slug}</p>
            <p>{release.category || "Uncategorized"}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onSelect(release.id)}>
            <Eye className="mr-2 h-4 w-4" />
            Review
          </Button>
        </div>
      ))}
    </section>
  );
}
