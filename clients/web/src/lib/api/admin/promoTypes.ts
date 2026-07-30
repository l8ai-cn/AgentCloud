export type PromoCodeType =
  | "media"
  | "partner"
  | "campaign"
  | "internal"
  | "referral";

export interface AdminPromoCode {
  id: number;
  code: string;
  name: string;
  description: string;
  type: PromoCodeType;
  plan_name: string;
  duration_months: number;
  max_uses: number | null;
  used_count: number;
  max_uses_per_org: number;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface AdminPromoCodeListParams {
  search?: string;
  type?: PromoCodeType;
  plan_name?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

export interface CreateAdminPromoCodeInput {
  code: string;
  name: string;
  description?: string;
  type: PromoCodeType;
  plan_name: string;
  duration_months: number;
  max_uses?: number;
  max_uses_per_org?: number;
  starts_at?: string;
  expires_at?: string;
}

export interface UpdateAdminPromoCodeInput {
  name?: string;
  description?: string;
  max_uses?: number;
  max_uses_per_org?: number;
  expires_at?: string;
}

export interface AdminPromoCodeRedemption {
  id: number;
  promo_code_id: number;
  organization_id: number;
  organization_name?: string;
  organization_slug?: string;
  user_id: number;
  user_email?: string;
  user_username?: string;
  plan_name: string;
  duration_months: number;
  new_period_end: string;
  ip_address: string | null;
  created_at: string;
}

export interface PromoCodePage<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
