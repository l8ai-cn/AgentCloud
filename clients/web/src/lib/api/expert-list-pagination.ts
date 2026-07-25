import type { Expert } from "@/lib/api/expertApi";
import { listExpertsForStatistics } from "@/lib/api/expert-statistics-api";

const PAGE_SIZE = 100;

export async function fetchAllExperts(
  orgSlug: string,
  signal?: AbortSignal,
): Promise<Expert[]> {
  const experts: Expert[] = [];
  const slugs = new Set<string>();
  let offset = 0;
  let expectedTotal: number | null = null;
  let snapshotMaxId: number | undefined;

  while (expectedTotal === null || offset < expectedTotal) {
    const page = await listExpertsForStatistics({
      orgSlug,
      limit: PAGE_SIZE,
      offset,
      snapshotMaxId,
      signal,
    });
    if (expectedTotal === null) {
      expectedTotal = page.total;
      snapshotMaxId = page.snapshotMaxId;
    } else if (page.snapshotMaxId !== snapshotMaxId) {
      throw new Error("Partner pagination crossed snapshot boundaries.");
    } else if (page.total !== expectedTotal) {
      throw new Error("Partner list changed while statistics were loading.");
    }
    if (page.experts.length === 0 && offset < expectedTotal) {
      throw new Error("Partner pagination stopped before all records were loaded.");
    }
    for (const expert of page.experts) {
      if (slugs.has(expert.slug)) {
        throw new Error(`Partner pagination returned duplicate slug: ${expert.slug}`);
      }
      slugs.add(expert.slug);
      experts.push(expert);
    }
    offset += page.experts.length;
  }

  return experts;
}
