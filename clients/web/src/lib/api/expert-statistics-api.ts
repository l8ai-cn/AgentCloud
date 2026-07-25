import { lightFetch } from "@/lib/light-auth/api-fetch";
import type { Expert } from "@/lib/api/expertApi";

interface ExpertStatisticsResponse {
  experts: Expert[];
  total: number;
  snapshot_max_id: number;
}

interface ExpertStatisticsQuery {
  orgSlug: string;
  limit: number;
  offset: number;
  snapshotMaxId?: number;
  signal?: AbortSignal;
}

export async function listExpertsForStatistics({
  orgSlug,
  limit,
  offset,
  snapshotMaxId,
  signal,
}: ExpertStatisticsQuery): Promise<{
  experts: Expert[];
  total: number;
  snapshotMaxId: number;
}> {
  const response = await lightFetch<ExpertStatisticsResponse>(
    `/api/v1/orgs/${encodeURIComponent(orgSlug)}/experts`,
    {
      authenticated: true,
      query: { limit, offset, snapshot_max_id: snapshotMaxId },
      signal,
    },
  );
  if (!Number.isSafeInteger(response.snapshot_max_id) || response.snapshot_max_id < 0) {
    throw new Error("Partner statistics response is missing its snapshot boundary.");
  }
  return {
    experts: response.experts ?? [],
    total: response.total ?? 0,
    snapshotMaxId: response.snapshot_max_id,
  };
}
