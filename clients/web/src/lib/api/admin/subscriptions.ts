import {
  AdminSubscriptionSchema,
  CancelAdminSubscriptionRequestSchema,
  CreateAdminSubscriptionRequestSchema,
  FreezeAdminSubscriptionRequestSchema,
  GetAdminSubscriptionRequestSchema,
  ListAdminPlansRequestSchema,
  ListAdminPlansResponseSchema,
  RenewAdminSubscriptionRequestSchema,
  SetAdminAutoRenewRequestSchema,
  SetAdminCustomQuotaRequestSchema,
  UnfreezeAdminSubscriptionRequestSchema,
  UpdateAdminCycleRequestSchema,
  UpdateAdminPlanRequestSchema,
  UpdateAdminSeatsRequestSchema,
} from "@proto/billing/v1/billing_admin_pb";

import {
  optionalSubscriptionFromProto,
  planFromProto,
  subscriptionFromProto,
} from "./subscriptionConversion";
import type { AdminSubscription } from "./subscriptionTypes";
import { callAdminConnect } from "./transport";

const SERVICE = "proto.billing.v1.SubscriptionAdminService";

export async function getSubscription(orgId: number): Promise<AdminSubscription | null> {
  const response = await callAdminConnect(
    SERVICE, "GetSubscription", GetAdminSubscriptionRequestSchema,
    AdminSubscriptionSchema, { orgId: BigInt(orgId) },
  );
  return optionalSubscriptionFromProto(response);
}

export async function listSubscriptionPlans(orgId: number) {
  const response = await callAdminConnect(
    SERVICE, "ListPlans", ListAdminPlansRequestSchema,
    ListAdminPlansResponseSchema, { orgId: BigInt(orgId) },
  );
  return response.data.map(planFromProto);
}

async function subscriptionMutation(
  method: string,
  requestSchema:
    | typeof CreateAdminSubscriptionRequestSchema
    | typeof UpdateAdminPlanRequestSchema
    | typeof UpdateAdminSeatsRequestSchema
    | typeof UpdateAdminCycleRequestSchema
    | typeof FreezeAdminSubscriptionRequestSchema
    | typeof UnfreezeAdminSubscriptionRequestSchema
    | typeof CancelAdminSubscriptionRequestSchema
    | typeof RenewAdminSubscriptionRequestSchema
    | typeof SetAdminAutoRenewRequestSchema
    | typeof SetAdminCustomQuotaRequestSchema,
  input: Record<string, unknown>,
): Promise<AdminSubscription> {
  const response = await callAdminConnect(
    SERVICE, method, requestSchema, AdminSubscriptionSchema, input,
  );
  return subscriptionFromProto(response);
}

export const createSubscription = (orgId: number, planName: string, months: number) =>
  subscriptionMutation("CreateSubscription", CreateAdminSubscriptionRequestSchema, {
    orgId: BigInt(orgId), planName, months,
  });
export const updateSubscriptionPlan = (orgId: number, planName: string) =>
  subscriptionMutation("UpdatePlan", UpdateAdminPlanRequestSchema, {
    orgId: BigInt(orgId), planName,
  });
export const updateSubscriptionSeats = (orgId: number, seatCount: number) =>
  subscriptionMutation("UpdateSeats", UpdateAdminSeatsRequestSchema, {
    orgId: BigInt(orgId), seatCount,
  });
export const updateSubscriptionCycle = (orgId: number, billingCycle: string) =>
  subscriptionMutation("UpdateCycle", UpdateAdminCycleRequestSchema, {
    orgId: BigInt(orgId), billingCycle,
  });
export const freezeSubscription = (orgId: number) =>
  subscriptionMutation("Freeze", FreezeAdminSubscriptionRequestSchema, { orgId: BigInt(orgId) });
export const unfreezeSubscription = (orgId: number) =>
  subscriptionMutation("Unfreeze", UnfreezeAdminSubscriptionRequestSchema, { orgId: BigInt(orgId) });
export const cancelSubscription = (orgId: number) =>
  subscriptionMutation("Cancel", CancelAdminSubscriptionRequestSchema, { orgId: BigInt(orgId) });
export const renewSubscription = (orgId: number, months: number) =>
  subscriptionMutation("Renew", RenewAdminSubscriptionRequestSchema, {
    orgId: BigInt(orgId), months,
  });
export const setSubscriptionAutoRenew = (orgId: number, autoRenew: boolean) =>
  subscriptionMutation("SetAutoRenew", SetAdminAutoRenewRequestSchema, {
    orgId: BigInt(orgId), autoRenew,
  });
export const setSubscriptionQuota = (orgId: number, resource: string, limit: number) =>
  subscriptionMutation("SetCustomQuota", SetAdminCustomQuotaRequestSchema, {
    orgId: BigInt(orgId), resource, limit,
  });
