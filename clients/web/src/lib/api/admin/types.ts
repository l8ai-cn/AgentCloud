export interface AdminPaginated<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DashboardStats {
  total_users: number;
  active_users: number;
  total_organizations: number;
  total_runners: number;
  online_runners: number;
  total_pods: number;
  active_pods: number;
  total_subscriptions: number;
  active_subscriptions: number;
  new_users_today: number;
  new_users_this_week: number;
  new_users_this_month: number;
}

export interface AdminUser {
  id: number;
  email: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_system_admin: boolean;
  is_email_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserListParams {
  search?: string;
  is_active?: boolean;
  is_admin?: boolean;
  page?: number;
  page_size?: number;
}

export interface AuditLog {
  id: number;
  admin_user_id: number;
  action: string;
  target_type: string;
  target_id: number;
  old_data: string | null;
  new_data: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  admin_user?: {
    id: number;
    email: string;
    username: string;
    name: string | null;
    avatar_url: string | null;
  };
}

export interface AuditLogListParams {
  admin_user_id?: number;
  action?: string;
  target_type?: string;
  target_id?: number;
  start_time?: string;
  end_time?: string;
  page?: number;
  page_size?: number;
}
