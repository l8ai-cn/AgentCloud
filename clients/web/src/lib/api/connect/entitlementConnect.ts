// Connect-RPC adapter for proto.entitlement.v1.EntitlementService (Layer 1,
// organization side). Binary in / binary out through the wasm bridge —
// conventions §2.5 forbids a JSON intermediate.
//
// Every list response is folded into the Rust entitlement cache before it is
// handed back, so the presence-is-allow-list verdict the UI renders comes from
// the Rust selector rather than a second implementation in TypeScript.

import {
  DeleteMemberEntitlementRequestSchema,
  DenyMemberEntitlementRequestSchema,
  EntitlementSchema,
  GrantMemberEntitlementRequestSchema,
  ListEntitlementsRequestSchema,
  ListEntitlementsResponseSchema,
  type Entitlement as ProtoEntitlement,
} from "@proto/entitlement/v1/entitlement_pb";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";
import { getEntitlementService, getEntitlementState } from "@/lib/wasm-core";
import type {
  EntitlementRecord,
  MemberEntitlementInput,
  ResourceAccessSummary,
} from "../entitlement/entitlementTypes";

export function fromProtoEntitlement(row: ProtoEntitlement): EntitlementRecord {
  return {
    id: Number(row.id),
    resource_kind: row.resourceKind,
    resource_key: row.resourceKey,
    organization_id: Number(row.organizationId),
    subject_kind: row.subjectKind === "user" ? "user" : "org",
    subject_user_id:
      row.subjectUserId === undefined ? null : Number(row.subjectUserId),
    effect: row.effect === "deny" ? "deny" : "allow",
    reason: row.reason,
    expires_at: row.expiresAt ?? null,
    granted_by: Number(row.grantedBy),
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function listEntitlements(
  orgSlug: string,
  organizationId: number,
  resourceKind?: string,
): Promise<{ items: EntitlementRecord[]; summaries: ResourceAccessSummary[] }> {
  const req = create(ListEntitlementsRequestSchema, { orgSlug, resourceKind });
  const bytes = toBinary(ListEntitlementsRequestSchema, req);
  const respBytes = new Uint8Array(
    await getEntitlementService().listEntitlementsConnect(bytes),
  );
  getEntitlementState().applyEntitlements(organizationId, respBytes);
  const resp = fromBinary(ListEntitlementsResponseSchema, respBytes);
  return { items: resp.items.map(fromProtoEntitlement), summaries: readSummaries() };
}

export function readSummaries(): ResourceAccessSummary[] {
  const raw = getEntitlementState().summariesJson(new Date().toISOString());
  return JSON.parse(raw || "[]") as ResourceAccessSummary[];
}

export function readSummary(kind: string, key: string): ResourceAccessSummary {
  const raw = getEntitlementState().summaryJson(kind, key, new Date().toISOString());
  return JSON.parse(raw) as ResourceAccessSummary;
}

export function grantMemberEntitlement(input: MemberEntitlementInput) {
  return writeMemberEntitlement(input, "grant");
}

export function denyMemberEntitlement(input: MemberEntitlementInput) {
  return writeMemberEntitlement(input, "deny");
}

async function writeMemberEntitlement(
  input: MemberEntitlementInput,
  effect: "grant" | "deny",
): Promise<EntitlementRecord> {
  const schema =
    effect === "grant"
      ? GrantMemberEntitlementRequestSchema
      : DenyMemberEntitlementRequestSchema;
  const bytes = toBinary(
    schema,
    create(schema, {
      orgSlug: input.orgSlug,
      resourceKind: input.resourceKind,
      resourceKey: input.resourceKey,
      userId: BigInt(input.userId),
      reason: input.reason,
      expiresAt: input.expiresAt,
    }),
  );
  const service = getEntitlementService();
  const respBytes = new Uint8Array(
    effect === "grant"
      ? await service.grantMemberEntitlementConnect(bytes)
      : await service.denyMemberEntitlementConnect(bytes),
  );
  getEntitlementState().applyEntitlement(respBytes);
  return fromProtoEntitlement(fromBinary(EntitlementSchema, respBytes));
}

export async function deleteMemberEntitlement(
  orgSlug: string,
  id: number,
): Promise<void> {
  const bytes = toBinary(
    DeleteMemberEntitlementRequestSchema,
    create(DeleteMemberEntitlementRequestSchema, { orgSlug, id: BigInt(id) }),
  );
  await getEntitlementService().deleteMemberEntitlementConnect(bytes);
  getEntitlementState().remove(id);
}
