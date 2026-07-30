import {
  AdminOrganizationSchema,
  DeleteOrganizationRequestSchema,
  DeleteOrganizationResponseSchema,
  GetOrganizationMembersRequestSchema,
  GetOrganizationMembersResponseSchema,
  GetOrganizationRequestSchema,
  ListOrganizationsRequestSchema,
  ListOrganizationsResponseSchema,
  type AdminOrganization as ProtoOrganization,
  type AdminOrganizationMember as ProtoMember,
} from "@proto/admin/v1/admin_pb";

import { callAdminConnect } from "./transport";
import type { AdminPaginated } from "./types";

const SERVICE = "proto.admin.v1.AdminService";

export interface AdminOrganization {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  subscription_plan: string;
  subscription_status: string;
  created_at: string;
  updated_at: string;
}

export interface AdminOrganizationMember {
  id: number;
  user_id: number;
  org_id: number;
  role: string;
  joined_at: string;
  user?: {
    id: number;
    email: string;
    username: string;
    name: string | null;
    avatar_url: string | null;
  };
}

function fromProto(org: ProtoOrganization): AdminOrganization {
  return {
    id: Number(org.id),
    name: org.name,
    slug: org.slug,
    logo_url: org.logoUrl ?? null,
    subscription_plan: org.subscriptionPlan,
    subscription_status: org.subscriptionStatus,
    created_at: org.createdAt,
    updated_at: org.updatedAt,
  };
}

function memberFromProto(member: ProtoMember): AdminOrganizationMember {
  return {
    id: Number(member.id),
    user_id: Number(member.userId),
    org_id: Number(member.orgId),
    role: member.role,
    joined_at: member.joinedAt,
    user: member.user
      ? {
          id: Number(member.user.id),
          email: member.user.email,
          username: member.user.username,
          name: member.user.name ?? null,
          avatar_url: member.user.avatarUrl ?? null,
        }
      : undefined,
  };
}

export async function listOrganizations(params?: {
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<AdminPaginated<AdminOrganization>> {
  const response = await callAdminConnect(
    SERVICE,
    "ListOrganizations",
    ListOrganizationsRequestSchema,
    ListOrganizationsResponseSchema,
    {
      search: params?.search,
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

export async function getOrganization(id: number): Promise<AdminOrganization> {
  const response = await callAdminConnect(
    SERVICE,
    "GetOrganization",
    GetOrganizationRequestSchema,
    AdminOrganizationSchema,
    { orgId: BigInt(id) },
  );
  return fromProto(response);
}

export async function getOrganizationMembers(id: number) {
  const response = await callAdminConnect(
    SERVICE,
    "GetOrganizationMembers",
    GetOrganizationMembersRequestSchema,
    GetOrganizationMembersResponseSchema,
    { orgId: BigInt(id) },
  );
  return response.members.map(memberFromProto);
}

export async function deleteOrganization(id: number): Promise<void> {
  await callAdminConnect(
    SERVICE,
    "DeleteOrganization",
    DeleteOrganizationRequestSchema,
    DeleteOrganizationResponseSchema,
    { orgId: BigInt(id) },
  );
}
