import {
  AdminUserSchema,
  DisableUserRequestSchema,
  EnableUserRequestSchema,
  GrantAdminRequestSchema,
  ListUsersRequestSchema,
  ListUsersResponseSchema,
  RevokeAdminRequestSchema,
  UnverifyUserEmailRequestSchema,
  VerifyUserEmailRequestSchema,
  type AdminUser as ProtoAdminUser,
} from "@proto/admin/v1/admin_pb";

import { callAdminConnect } from "./transport";
import type { AdminPaginated, AdminUser, AdminUserListParams } from "./types";

const SERVICE = "proto.admin.v1.AdminService";

function fromProto(user: ProtoAdminUser): AdminUser {
  return {
    id: Number(user.id),
    email: user.email,
    username: user.username,
    name: user.name ?? null,
    avatar_url: user.avatarUrl ?? null,
    is_active: user.isActive,
    is_system_admin: user.isSystemAdmin,
    is_email_verified: user.isEmailVerified,
    last_login_at: user.lastLoginAt ?? null,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

export async function listUsers(
  params?: AdminUserListParams,
): Promise<AdminPaginated<AdminUser>> {
  const response = await callAdminConnect(
    SERVICE,
    "ListUsers",
    ListUsersRequestSchema,
    ListUsersResponseSchema,
    {
      search: params?.search,
      isActive: params?.is_active,
      isAdmin: params?.is_admin,
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

export async function disableUser(id: number): Promise<AdminUser> {
  const user = await callAdminConnect(
    SERVICE,
    "DisableUser",
    DisableUserRequestSchema,
    AdminUserSchema,
    { userId: BigInt(id) },
  );
  return fromProto(user);
}

export async function enableUser(id: number): Promise<AdminUser> {
  const user = await callAdminConnect(
    SERVICE,
    "EnableUser",
    EnableUserRequestSchema,
    AdminUserSchema,
    { userId: BigInt(id) },
  );
  return fromProto(user);
}

export async function grantAdmin(id: number): Promise<AdminUser> {
  const user = await callAdminConnect(
    SERVICE,
    "GrantAdmin",
    GrantAdminRequestSchema,
    AdminUserSchema,
    { userId: BigInt(id) },
  );
  return fromProto(user);
}

export async function revokeAdmin(id: number): Promise<AdminUser> {
  const user = await callAdminConnect(
    SERVICE,
    "RevokeAdmin",
    RevokeAdminRequestSchema,
    AdminUserSchema,
    { userId: BigInt(id) },
  );
  return fromProto(user);
}

export async function verifyUserEmail(id: number): Promise<AdminUser> {
  const user = await callAdminConnect(
    SERVICE,
    "VerifyUserEmail",
    VerifyUserEmailRequestSchema,
    AdminUserSchema,
    { userId: BigInt(id) },
  );
  return fromProto(user);
}

export async function unverifyUserEmail(id: number): Promise<AdminUser> {
  const user = await callAdminConnect(
    SERVICE,
    "UnverifyUserEmail",
    UnverifyUserEmailRequestSchema,
    AdminUserSchema,
    { userId: BigInt(id) },
  );
  return fromProto(user);
}
