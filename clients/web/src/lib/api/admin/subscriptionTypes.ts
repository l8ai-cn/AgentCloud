export interface AdminSubscriptionPlan {
  id: number;
  name: string;
  display_name: string;
  price_per_seat_monthly: number;
  price_per_seat_yearly: number;
  included_pod_minutes: number;
  max_users: number;
  max_runners: number;
  max_concurrent_pods: number;
  max_repositories: number;
}

export interface AdminSeatUsage {
  total_seats: number;
  used_seats: number;
  available_seats: number;
  max_seats: number;
  can_add_seats: boolean;
}

export interface AdminSubscription {
  id: number;
  organization_id: number;
  plan_id: number;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
  auto_renew: boolean;
  seat_count: number;
  cancel_at_period_end: boolean;
  custom_quotas: Record<string, number> | null;
  payment_provider?: string;
  canceled_at?: string;
  frozen_at?: string;
  downgrade_to_plan?: string;
  next_billing_cycle?: string;
  plan?: AdminSubscriptionPlan;
  seat_usage?: AdminSeatUsage;
}
