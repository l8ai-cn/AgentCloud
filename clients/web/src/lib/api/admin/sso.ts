import {
  AdminSSOConfigSchema,
  CreateSSOConfigRequestSchema,
  DeleteSSOConfigRequestSchema,
  DeleteSSOConfigResponseSchema,
  DisableSSOConfigRequestSchema,
  EnableSSOConfigRequestSchema,
  GetSSOConfigRequestSchema,
  ListSSOConfigsRequestSchema,
  ListSSOConfigsResponseSchema,
  TestSSOConnectionRequestSchema,
  TestSSOConnectionResponseSchema,
  UpdateSSOConfigRequestSchema,
} from "@proto/sso/v1/sso_admin_pb";

import { callAdminConnect } from "./transport";
import {
  createSSOConfigMessage,
  ssoConfigFromProto,
  updateSSOConfigMessage,
} from "./ssoMessageConversion";
import type {
  SSOConfig,
  SSOConfigInput,
  SSOConfigListParams,
  SSOTestResult,
  UpdateSSOConfigInput,
} from "./ssoTypes";
import type { AdminPaginated } from "./types";

export type {
  SSOConfig,
  SSOConfigInput,
  SSOConfigListParams,
  SSOProtocol,
  SSOTestResult,
  UpdateSSOConfigInput,
} from "./ssoTypes";

const SERVICE = "proto.sso.v1.SSOAdminService";

export async function listSSOConfigs(
  params?: SSOConfigListParams,
): Promise<AdminPaginated<SSOConfig>> {
  const response = await callAdminConnect(
    SERVICE,
    "ListSSOConfigs",
    ListSSOConfigsRequestSchema,
    ListSSOConfigsResponseSchema,
    {
      search: params?.search,
      protocol: params?.protocol,
      page: params?.page,
      pageSize: params?.page_size,
    },
  );
  return {
    data: response.data.map(ssoConfigFromProto),
    total: Number(response.total),
    page: response.page,
    page_size: response.pageSize,
    total_pages: Number(response.totalPages),
  };
}

export async function getSSOConfig(id: number): Promise<SSOConfig> {
  const response = await callAdminConnect(
    SERVICE,
    "GetSSOConfig",
    GetSSOConfigRequestSchema,
    AdminSSOConfigSchema,
    { id: BigInt(id) },
  );
  return ssoConfigFromProto(response);
}

export async function createSSOConfig(input: SSOConfigInput): Promise<SSOConfig> {
  const response = await callAdminConnect(
    SERVICE,
    "CreateSSOConfig",
    CreateSSOConfigRequestSchema,
    AdminSSOConfigSchema,
    createSSOConfigMessage(input),
  );
  return ssoConfigFromProto(response);
}

export async function updateSSOConfig(
  id: number,
  input: UpdateSSOConfigInput,
): Promise<SSOConfig> {
  const response = await callAdminConnect(
    SERVICE,
    "UpdateSSOConfig",
    UpdateSSOConfigRequestSchema,
    AdminSSOConfigSchema,
    updateSSOConfigMessage(id, input),
  );
  return ssoConfigFromProto(response);
}

export async function deleteSSOConfig(id: number): Promise<void> {
  await callAdminConnect(
    SERVICE,
    "DeleteSSOConfig",
    DeleteSSOConfigRequestSchema,
    DeleteSSOConfigResponseSchema,
    { id: BigInt(id) },
  );
}

async function setSSOConfigEnabled(id: number, enabled: boolean): Promise<SSOConfig> {
  const response = await callAdminConnect(
    SERVICE,
    enabled ? "EnableSSOConfig" : "DisableSSOConfig",
    enabled ? EnableSSOConfigRequestSchema : DisableSSOConfigRequestSchema,
    AdminSSOConfigSchema,
    { id: BigInt(id) },
  );
  return ssoConfigFromProto(response);
}

export function enableSSOConfig(id: number) {
  return setSSOConfigEnabled(id, true);
}

export function disableSSOConfig(id: number) {
  return setSSOConfigEnabled(id, false);
}

export async function testSSOConnection(id: number): Promise<SSOTestResult> {
  const response = await callAdminConnect(
    SERVICE,
    "TestSSOConnection",
    TestSSOConnectionRequestSchema,
    TestSSOConnectionResponseSchema,
    { id: BigInt(id) },
  );
  return {
    success: response.success,
    message: response.message,
    error: response.error,
  };
}
