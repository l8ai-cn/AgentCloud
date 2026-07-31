import type { ExpertReleaseStatus } from "@/lib/api/admin/expertMarket";

export const expertReleaseStatuses: ExpertReleaseStatus[] = [
  "pending",
  "published",
  "rejected",
  "withdrawn",
];

export const expertReleaseStatusLabelKeys: Record<ExpertReleaseStatus, string> = {
  pending: "expertMarket.status.pending",
  published: "expertMarket.status.published",
  rejected: "expertMarket.status.rejected",
  withdrawn: "expertMarket.status.withdrawn",
};
