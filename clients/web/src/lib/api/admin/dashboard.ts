import {
  DashboardStatsSchema,
  GetDashboardStatsRequestSchema,
} from "@proto/admin/v1/admin_pb";

import { callAdminConnect } from "./transport";
import type { DashboardStats } from "./types";

const SERVICE = "proto.admin.v1.AdminService";

export async function getDashboardStats(): Promise<DashboardStats> {
  const stats = await callAdminConnect(
    SERVICE,
    "GetDashboardStats",
    GetDashboardStatsRequestSchema,
    DashboardStatsSchema,
    {},
  );
  return {
    total_users: Number(stats.totalUsers),
    active_users: Number(stats.activeUsers),
    total_organizations: Number(stats.totalOrganizations),
    total_runners: Number(stats.totalRunners),
    online_runners: Number(stats.onlineRunners),
    total_pods: Number(stats.totalPods),
    active_pods: Number(stats.activePods),
    total_subscriptions: Number(stats.totalSubscriptions),
    active_subscriptions: Number(stats.activeSubscriptions),
    new_users_today: Number(stats.newUsersToday),
    new_users_this_week: Number(stats.newUsersThisWeek),
    new_users_this_month: Number(stats.newUsersThisMonth),
  };
}
