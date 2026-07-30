import {
  AdminRunnerSchema,
  DeleteRunnerRequestSchema,
  DeleteRunnerResponseSchema,
  DisableRunnerRequestSchema,
  EnableRunnerRequestSchema,
  ListRunnersRequestSchema,
  ListRunnersResponseSchema,
  type AdminRunner as ProtoAdminRunner,
} from "@proto/admin/v1/admin_pb";

import { callAdminConnect } from "./transport";
import type { AdminPaginated } from "./types";

export interface AdminRunner {
  id: number;
  organization_id: number;
  node_id: string;
  description: string | null;
  status: string;
  is_enabled: boolean;
  runner_version: string | null;
  current_pods: number;
  max_concurrent_pods: number;
  available_agents: string[];
  host_info: Record<string, unknown> | null;
  last_heartbeat: string | null;
  created_at: string;
  updated_at: string;
  organization?: {
    id: number;
    name: string;
    slug: string;
  };
}

export interface AdminRunnerListParams {
  search?: string;
  status?: string;
  org_id?: number;
  page?: number;
  page_size?: number;
}

const SERVICE = "proto.admin.v1.AdminService";

function fromProto(runner: ProtoAdminRunner): AdminRunner {
  let hostInfo: Record<string, unknown> | null = null;
  if (runner.hostInfoJson) {
    try {
      hostInfo = JSON.parse(runner.hostInfoJson) as Record<string, unknown>;
    } catch {
      hostInfo = null;
    }
  }
  return {
    id: Number(runner.id),
    organization_id: Number(runner.organizationId),
    node_id: runner.nodeId,
    description: runner.description ?? null,
    status: runner.status,
    is_enabled: runner.isEnabled,
    runner_version: runner.runnerVersion ?? null,
    current_pods: runner.currentPods,
    max_concurrent_pods: runner.maxConcurrentPods,
    available_agents: runner.availableAgents,
    host_info: hostInfo,
    last_heartbeat: runner.lastHeartbeat ?? null,
    created_at: runner.createdAt,
    updated_at: runner.updatedAt,
    organization: runner.organization
      ? {
          id: Number(runner.organization.id),
          name: runner.organization.name,
          slug: runner.organization.slug,
        }
      : undefined,
  };
}

export async function listRunners(
  params?: AdminRunnerListParams,
): Promise<AdminPaginated<AdminRunner>> {
  const response = await callAdminConnect(
    SERVICE,
    "ListRunners",
    ListRunnersRequestSchema,
    ListRunnersResponseSchema,
    {
      search: params?.search,
      status: params?.status,
      orgId: params?.org_id !== undefined ? BigInt(params.org_id) : undefined,
      page: params?.page,
      pageSize: params?.page_size,
    },
  );
  return {
    data: response.items.map(fromProto),
    total: Number(response.total),
    page: response.page,
    page_size: response.pageSize,
    total_pages: response.totalPages,
  };
}

export async function disableRunner(id: number): Promise<AdminRunner> {
  const runner = await callAdminConnect(
    SERVICE,
    "DisableRunner",
    DisableRunnerRequestSchema,
    AdminRunnerSchema,
    { runnerId: BigInt(id) },
  );
  return fromProto(runner);
}

export async function enableRunner(id: number): Promise<AdminRunner> {
  const runner = await callAdminConnect(
    SERVICE,
    "EnableRunner",
    EnableRunnerRequestSchema,
    AdminRunnerSchema,
    { runnerId: BigInt(id) },
  );
  return fromProto(runner);
}

export async function deleteRunner(id: number): Promise<{ message: string }> {
  const response = await callAdminConnect(
    SERVICE,
    "DeleteRunner",
    DeleteRunnerRequestSchema,
    DeleteRunnerResponseSchema,
    { runnerId: BigInt(id) },
  );
  return { message: response.message };
}
