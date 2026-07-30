import {
  ActivatePromoCodeRequestSchema,
  ActivatePromoCodeResponseSchema,
  CreatePromoCodeRequestSchema,
  DeactivatePromoCodeRequestSchema,
  DeactivatePromoCodeResponseSchema,
  DeletePromoCodeRequestSchema,
  DeletePromoCodeResponseSchema,
  GetPromoCodeRequestSchema,
  ListPromoCodeRedemptionsRequestSchema,
  ListPromoCodeRedemptionsResponseSchema,
  ListPromoCodesRequestSchema,
  ListPromoCodesResponseSchema,
  PromoCodeSchema,
  UpdatePromoCodeRequestSchema,
} from "@proto/promocode/v1/promocode_admin_pb";

import { callAdminConnect } from "./transport";
import {
  promoCodeFromProto,
  promoRedemptionFromProto,
} from "./promoConversion";
import type {
  AdminPromoCode,
  AdminPromoCodeListParams,
  AdminPromoCodeRedemption,
  CreateAdminPromoCodeInput,
  PromoCodePage,
  UpdateAdminPromoCodeInput,
} from "./promoTypes";

const SERVICE = "proto.promocode.v1.PromoCodeAdminService";

export async function listPromoCodes(
  params?: AdminPromoCodeListParams,
): Promise<PromoCodePage<AdminPromoCode>> {
  const response = await callAdminConnect(
    SERVICE,
    "ListPromoCodes",
    ListPromoCodesRequestSchema,
    ListPromoCodesResponseSchema,
    {
      type: params?.type,
      planName: params?.plan_name,
      isActive: params?.is_active,
      search: params?.search,
      page: params?.page,
      pageSize: params?.page_size,
    },
  );
  return {
    data: response.data.map(promoCodeFromProto),
    total: Number(response.total),
    page: response.page,
    page_size: response.pageSize,
    total_pages: response.totalPages,
  };
}

export async function getPromoCode(id: number): Promise<AdminPromoCode> {
  const response = await callAdminConnect(
    SERVICE,
    "GetPromoCode",
    GetPromoCodeRequestSchema,
    PromoCodeSchema,
    { id: BigInt(id) },
  );
  return promoCodeFromProto(response);
}

export async function createPromoCode(
  input: CreateAdminPromoCodeInput,
): Promise<AdminPromoCode> {
  const response = await callAdminConnect(
    SERVICE,
    "CreatePromoCode",
    CreatePromoCodeRequestSchema,
    PromoCodeSchema,
    {
      code: input.code,
      name: input.name,
      description: input.description ?? "",
      type: input.type,
      planName: input.plan_name,
      durationMonths: input.duration_months,
      maxUses: input.max_uses,
      maxUsesPerOrg: input.max_uses_per_org ?? 1,
      startsAt: input.starts_at,
      expiresAt: input.expires_at,
    },
  );
  return promoCodeFromProto(response);
}

export async function updatePromoCode(
  id: number,
  input: UpdateAdminPromoCodeInput,
): Promise<AdminPromoCode> {
  const clearExpiresAt = input.expires_at === "";
  const response = await callAdminConnect(
    SERVICE,
    "UpdatePromoCode",
    UpdatePromoCodeRequestSchema,
    PromoCodeSchema,
    {
      id: BigInt(id),
      name: input.name,
      description: input.description,
      maxUses: input.max_uses,
      maxUsesPerOrg: input.max_uses_per_org,
      expiresAt: clearExpiresAt ? undefined : input.expires_at,
      clearExpiresAt,
    },
  );
  return promoCodeFromProto(response);
}

async function runStatusAction(
  id: number,
  method: "ActivatePromoCode" | "DeactivatePromoCode",
) {
  if (method === "ActivatePromoCode") {
    return callAdminConnect(
      SERVICE,
      method,
      ActivatePromoCodeRequestSchema,
      ActivatePromoCodeResponseSchema,
      { id: BigInt(id) },
    );
  }
  return callAdminConnect(
    SERVICE,
    method,
    DeactivatePromoCodeRequestSchema,
    DeactivatePromoCodeResponseSchema,
    { id: BigInt(id) },
  );
}

export function activatePromoCode(id: number): Promise<{ message: string }> {
  return runStatusAction(id, "ActivatePromoCode");
}

export function deactivatePromoCode(id: number): Promise<{ message: string }> {
  return runStatusAction(id, "DeactivatePromoCode");
}

export function deletePromoCode(id: number): Promise<{ message: string }> {
  return callAdminConnect(
    SERVICE,
    "DeletePromoCode",
    DeletePromoCodeRequestSchema,
    DeletePromoCodeResponseSchema,
    { id: BigInt(id) },
  );
}

export async function listPromoCodeRedemptions(
  id: number,
  params?: { page?: number; page_size?: number },
): Promise<PromoCodePage<AdminPromoCodeRedemption>> {
  const response = await callAdminConnect(
    SERVICE,
    "ListPromoCodeRedemptions",
    ListPromoCodeRedemptionsRequestSchema,
    ListPromoCodeRedemptionsResponseSchema,
    { id: BigInt(id), page: params?.page, pageSize: params?.page_size },
  );
  return {
    data: response.data.map(promoRedemptionFromProto),
    total: Number(response.total),
    page: response.page,
    page_size: response.pageSize,
    total_pages: response.totalPages,
  };
}
