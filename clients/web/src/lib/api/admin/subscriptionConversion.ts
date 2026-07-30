import type {
  AdminSeatUsage as ProtoSeatUsage,
  AdminSubscription as ProtoSubscription,
  AdminSubscriptionPlan as ProtoPlan,
} from "@proto/billing/v1/billing_admin_pb";

import type {
  AdminSeatUsage,
  AdminSubscription,
  AdminSubscriptionPlan,
} from "./subscriptionTypes";

export function planFromProto(plan: ProtoPlan): AdminSubscriptionPlan {
  return {
    id: Number(plan.id),
    name: plan.name,
    display_name: plan.displayName,
    price_per_seat_monthly: plan.pricePerSeatMonthly,
    price_per_seat_yearly: plan.pricePerSeatYearly,
    included_pod_minutes: plan.includedPodMinutes,
    max_users: plan.maxUsers,
    max_runners: plan.maxRunners,
    max_concurrent_pods: plan.maxConcurrentPods,
    max_repositories: plan.maxRepositories,
  };
}

function seatUsageFromProto(usage: ProtoSeatUsage): AdminSeatUsage {
  return {
    total_seats: usage.totalSeats,
    used_seats: usage.usedSeats,
    available_seats: usage.availableSeats,
    max_seats: usage.maxSeats,
    can_add_seats: usage.canAddSeats,
  };
}

export function subscriptionFromProto(response: ProtoSubscription): AdminSubscription {
  if (!response.subscription) throw new Error("Subscription response is incomplete.");
  const subscription = response.subscription;
  return {
    id: Number(subscription.id),
    organization_id: Number(subscription.organizationId),
    plan_id: Number(subscription.planId),
    status: subscription.status,
    billing_cycle: subscription.billingCycle,
    current_period_start: subscription.currentPeriodStart,
    current_period_end: subscription.currentPeriodEnd,
    auto_renew: subscription.autoRenew,
    seat_count: subscription.seatCount,
    cancel_at_period_end: subscription.cancelAtPeriodEnd,
    custom_quotas: response.customQuotasJson
      ? (JSON.parse(response.customQuotasJson) as Record<string, number>)
      : null,
    payment_provider: subscription.paymentProvider,
    canceled_at: subscription.canceledAt,
    frozen_at: subscription.frozenAt,
    downgrade_to_plan: subscription.downgradeToPlan,
    next_billing_cycle: subscription.nextBillingCycle,
    plan: subscription.plan ? planFromProto(subscription.plan) : undefined,
    seat_usage: response.seatUsage
      ? seatUsageFromProto(response.seatUsage)
      : undefined,
  };
}

export function optionalSubscriptionFromProto(
  response: ProtoSubscription,
): AdminSubscription | null {
  return response.subscription ? subscriptionFromProto(response) : null;
}
