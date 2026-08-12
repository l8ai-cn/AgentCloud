// Platform side of Layer 1 — proto.entitlement.v1.EntitlementAdminService.
// Sits on the admin Connect transport rather than the wasm bridge for the same
// reason every other /admin surface does: the system-admin auth surface is
// separate from the org-scoped one, and mixing them in one client service is
// what the proto split exists to prevent.

import {
  DeleteEntitlementRequestSchema,
  DeleteEntitlementResponseSchema,
  DenyEntitlementRequestSchema,
  GrantEntitlementRequestSchema,
  ListOrganizationEntitlementsRequestSchema,
  ListOrganizationEntitlementsResponseSchema,
  ListResourceEntitlementsRequestSchema,
  ListResourceEntitlementsResponseSchema,
} from "@proto/entitlement/v1/entitlement_admin_pb";
import { EntitlementSchema } from "@proto/entitlement/v1/entitlement_pb";

import { fromProtoEntitlement } from "../connect/entitlementConnect";
import type { EntitlementRecord } from "../entitlement/entitlementTypes";
import { callAdminConnect } from "./transport";

const SERVICE = "proto.entitlement.v1.EntitlementAdminService";

export interface AdminEntitlementWriteInput {
  resourceKind: string;
  resourceKey: string;
  organizationId: number;
  subjectUserId?: number;
  reason: string;
  expiresAt?: string;
}

export async function listOrganizationEntitlements(
  organizationId: number,
  resourceKind?: string,
): Promise<EntitlementRecord[]> {
  const response = await callAdminConnect(
    SERVICE,
    "ListOrganizationEntitlements",
    ListOrganizationEntitlementsRequestSchema,
    ListOrganizationEntitlementsResponseSchema,
    { organizationId: BigInt(organizationId), resourceKind },
  );
  return response.items.map(fromProtoEntitlement);
}

export async function listResourceEntitlements(
  resourceKind: string,
  resourceKey: string,
): Promise<EntitlementRecord[]> {
  const response = await callAdminConnect(
    SERVICE,
    "ListResourceEntitlements",
    ListResourceEntitlementsRequestSchema,
    ListResourceEntitlementsResponseSchema,
    { resourceKind, resourceKey },
  );
  return response.items.map(fromProtoEntitlement);
}

export function grantEntitlement(input: AdminEntitlementWriteInput) {
  return writeEntitlement(input, "GrantEntitlement");
}

export function denyEntitlement(input: AdminEntitlementWriteInput) {
  return writeEntitlement(input, "DenyEntitlement");
}

async function writeEntitlement(
  input: AdminEntitlementWriteInput,
  method: "GrantEntitlement" | "DenyEntitlement",
): Promise<EntitlementRecord> {
  const schema =
    method === "GrantEntitlement"
      ? GrantEntitlementRequestSchema
      : DenyEntitlementRequestSchema;
  const response = await callAdminConnect(SERVICE, method, schema, EntitlementSchema, {
    resourceKind: input.resourceKind,
    resourceKey: input.resourceKey,
    organizationId: BigInt(input.organizationId),
    subjectUserId:
      input.subjectUserId === undefined ? undefined : BigInt(input.subjectUserId),
    reason: input.reason,
    expiresAt: input.expiresAt,
  });
  return fromProtoEntitlement(response);
}

export async function deleteEntitlement(id: number): Promise<void> {
  await callAdminConnect(
    SERVICE,
    "DeleteEntitlement",
    DeleteEntitlementRequestSchema,
    DeleteEntitlementResponseSchema,
    { id: BigInt(id) },
  );
}
