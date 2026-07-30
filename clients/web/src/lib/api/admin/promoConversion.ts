import type {
  PromoCode as ProtoPromoCode,
  RedemptionDetail,
} from "@proto/promocode/v1/promocode_admin_pb";

import type {
  AdminPromoCode,
  AdminPromoCodeRedemption,
  PromoCodeType,
} from "./promoTypes";

function promoCodeType(value: string): PromoCodeType {
  switch (value) {
    case "media":
    case "partner":
    case "campaign":
    case "internal":
    case "referral":
      return value;
    default:
      throw new Error(`Unsupported promo code type: ${value}`);
  }
}

function safeId(value: bigint, field: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${field} exceeds the JavaScript safe integer range`);
  }
  return result;
}

export function promoCodeFromProto(code: ProtoPromoCode): AdminPromoCode {
  return {
    id: safeId(code.id, "promo code id"),
    code: code.code,
    name: code.name,
    description: code.description,
    type: promoCodeType(code.type),
    plan_name: code.planName,
    duration_months: code.durationMonths,
    max_uses: code.maxUses ?? null,
    used_count: code.usedCount,
    max_uses_per_org: code.maxUsesPerOrg,
    starts_at: code.startsAt,
    expires_at: code.expiresAt ?? null,
    is_active: code.isActive,
    created_by_id:
      code.createdById === undefined
        ? null
        : safeId(code.createdById, "creator id"),
    created_at: code.createdAt,
    updated_at: code.updatedAt,
  };
}

export function promoRedemptionFromProto(
  redemption: RedemptionDetail,
): AdminPromoCodeRedemption {
  return {
    id: safeId(redemption.id, "redemption id"),
    promo_code_id: safeId(redemption.promoCodeId, "promo code id"),
    organization_id: safeId(redemption.organizationId, "organization id"),
    organization_name: redemption.organizationName,
    organization_slug: redemption.organizationSlug,
    user_id: safeId(redemption.userId, "user id"),
    user_email: redemption.userEmail,
    user_username: redemption.userUsername,
    plan_name: redemption.planName,
    duration_months: redemption.durationMonths,
    new_period_end: redemption.newPeriodEnd,
    ip_address: redemption.ipAddress ?? null,
    created_at: redemption.createdAt,
  };
}
