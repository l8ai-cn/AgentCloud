import {
  ApproveExpertMarketReleaseRequestSchema,
  ExpertMarketReleaseSchema,
  GetExpertMarketReleaseRequestSchema,
  ListExpertMarketReleasesRequestSchema,
  ListExpertMarketReleasesResponseSchema,
  RejectExpertMarketReleaseRequestSchema,
  type ExpertMarketRelease as ProtoRelease,
} from "@proto/admin/v1/admin_pb";

import { callAdminConnect } from "./transport";

const SERVICE = "proto.admin.v1.AdminService";

export type ExpertReleaseStatus = "pending" | "published" | "rejected" | "withdrawn";

export interface ExpertRelease {
  id: number;
  application_slug: string;
  version: number;
  status: ExpertReleaseStatus;
  name: string;
  summary: string;
  description: string;
  category: string;
  tags: string[];
  outcomes: string[];
  featured: boolean;
  expert_snapshot_json: string;
  worker_spec_snapshot_json: string;
  skill_dependencies_json: string;
  rejection_reason?: string;
  submitted_at?: string;
  reviewed_at?: string;
  created_at: string;
}

function fromProto(release: ProtoRelease): ExpertRelease {
  return {
    id: Number(release.id),
    application_slug: release.applicationSlug,
    version: release.version,
    status: release.status as ExpertReleaseStatus,
    name: release.name,
    summary: release.summary,
    description: release.description,
    category: release.category,
    tags: release.tags,
    outcomes: release.outcomes,
    featured: release.featured,
    expert_snapshot_json: release.expertSnapshotJson,
    worker_spec_snapshot_json: release.workerSpecSnapshotJson,
    skill_dependencies_json: release.skillDependenciesJson,
    rejection_reason: release.rejectionReason,
    submitted_at: release.submittedAt,
    reviewed_at: release.reviewedAt,
    created_at: release.createdAt,
  };
}

export async function listExpertReleases(
  status: ExpertReleaseStatus,
  limit = 20,
  offset = 0,
) {
  const response = await callAdminConnect(
    SERVICE,
    "ListExpertMarketReleases",
    ListExpertMarketReleasesRequestSchema,
    ListExpertMarketReleasesResponseSchema,
    { status, limit, offset },
  );
  return {
    data: response.items.map(fromProto),
    total: Number(response.total),
    limit: response.limit,
    offset: response.offset,
  };
}

export async function getExpertRelease(id: number) {
  const response = await callAdminConnect(
    SERVICE,
    "GetExpertMarketRelease",
    GetExpertMarketReleaseRequestSchema,
    ExpertMarketReleaseSchema,
    { releaseId: BigInt(id) },
  );
  return fromProto(response);
}

export async function approveExpertRelease(id: number) {
  const response = await callAdminConnect(
    SERVICE,
    "ApproveExpertMarketRelease",
    ApproveExpertMarketReleaseRequestSchema,
    ExpertMarketReleaseSchema,
    { releaseId: BigInt(id) },
  );
  return fromProto(response);
}

export async function rejectExpertRelease(id: number, reason: string) {
  const response = await callAdminConnect(
    SERVICE,
    "RejectExpertMarketRelease",
    RejectExpertMarketReleaseRequestSchema,
    ExpertMarketReleaseSchema,
    { releaseId: BigInt(id), reason },
  );
  return fromProto(response);
}
