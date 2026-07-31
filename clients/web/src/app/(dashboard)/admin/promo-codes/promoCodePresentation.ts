import type {
  AdminPromoCode,
  PromoCodeType,
} from "@/lib/api/admin/promoTypes";

export const promoTypeLabelKeys: Record<PromoCodeType, string> = {
  media: "promoCodes.type.media",
  partner: "promoCodes.type.partner",
  campaign: "promoCodes.type.campaign",
  internal: "promoCodes.type.internal",
  referral: "promoCodes.type.referral",
};

export function promoStatus(code: AdminPromoCode) {
  if (code.expires_at && new Date(code.expires_at).getTime() < Date.now()) {
    return {
      labelKey: "promoCodes.status.expired",
      variant: "destructive" as const,
    };
  }
  if (code.max_uses !== null && code.used_count >= code.max_uses) {
    return {
      labelKey: "promoCodes.status.exhausted",
      variant: "warning" as const,
    };
  }
  return code.is_active
    ? { labelKey: "promoCodes.status.active", variant: "success" as const }
    : { labelKey: "promoCodes.status.inactive", variant: "secondary" as const };
}

export function promoUsageMessage(code: AdminPromoCode): {
  key: string;
  values: Record<string, number>;
} {
  return code.max_uses === null
    ? {
        key: "promoCodes.usage.unlimited",
        values: { used: code.used_count },
      }
    : {
        key: "promoCodes.usage.limited",
        values: { used: code.used_count, limit: code.max_uses },
      };
}

export function formatPromoDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
