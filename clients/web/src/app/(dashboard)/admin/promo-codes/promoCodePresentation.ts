import type {
  AdminPromoCode,
  PromoCodeType,
} from "@/lib/api/admin/promoTypes";

export const promoTypeLabels: Record<PromoCodeType, string> = {
  media: "Media",
  partner: "Partner",
  campaign: "Campaign",
  internal: "Internal",
  referral: "Referral",
};

export function promoStatus(code: AdminPromoCode) {
  if (code.expires_at && new Date(code.expires_at).getTime() < Date.now()) {
    return { label: "Expired", variant: "destructive" as const };
  }
  if (code.max_uses !== null && code.used_count >= code.max_uses) {
    return { label: "Exhausted", variant: "warning" as const };
  }
  return code.is_active
    ? { label: "Active", variant: "success" as const }
    : { label: "Inactive", variant: "secondary" as const };
}

export function usageLabel(code: AdminPromoCode) {
  return code.max_uses === null
    ? `${code.used_count.toLocaleString()} / unlimited`
    : `${code.used_count.toLocaleString()} / ${code.max_uses.toLocaleString()}`;
}

export function formatPromoDate(value: string | null) {
  if (!value) return "Never";
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
