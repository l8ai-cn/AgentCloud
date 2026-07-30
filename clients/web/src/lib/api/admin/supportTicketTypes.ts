import type { AdminPaginated } from "./types";

export type SupportTicketStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "closed";

export type SupportTicketCategory =
  | "bug"
  | "feature_request"
  | "usage_question"
  | "account"
  | "other";

export type SupportTicketPriority = "low" | "medium" | "high";

export interface SupportTicketUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
}

export interface SupportTicketAttachment {
  id: number;
  original_name: string;
  mime_type: string;
  size: number;
}

export interface SupportTicketMessage {
  id: number;
  ticket_id: number;
  user_id: number;
  content: string;
  is_admin_reply: boolean;
  created_at: string;
  user: SupportTicketUser | null;
  attachments: SupportTicketAttachment[];
}

export interface SupportTicket {
  id: number;
  user_id: number;
  title: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  assigned_admin_id: number | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface SupportTicketStats {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
}

export interface SupportTicketListParams {
  search?: string;
  status?: SupportTicketStatus;
  category?: SupportTicketCategory;
  priority?: SupportTicketPriority;
  page?: number;
  page_size?: number;
}

export interface SupportTicketDetail {
  ticket: SupportTicket;
  messages: SupportTicketMessage[];
}

export type SupportTicketPage = AdminPaginated<SupportTicket>;
