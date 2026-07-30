import type {
  AdminSupportTicket,
  AdminSupportTicketAttachment,
  AdminSupportTicketMessage,
  AdminSupportTicketUser,
} from "@proto/support_ticket/v1/support_ticket_admin_pb";

import type {
  SupportTicket,
  SupportTicketAttachment,
  SupportTicketCategory,
  SupportTicketMessage,
  SupportTicketPriority,
  SupportTicketStatus,
  SupportTicketUser,
} from "./supportTicketTypes";

export function supportTicketFromProto(ticket: AdminSupportTicket): SupportTicket {
  return {
    id: Number(ticket.id),
    user_id: Number(ticket.userId),
    title: ticket.title,
    category: ticket.category as SupportTicketCategory,
    status: ticket.status as SupportTicketStatus,
    priority: ticket.priority as SupportTicketPriority,
    assigned_admin_id:
      ticket.assignedAdminId === undefined ? null : Number(ticket.assignedAdminId),
    created_at: ticket.createdAt,
    updated_at: ticket.updatedAt,
    resolved_at: ticket.resolvedAt ?? null,
  };
}

export function supportTicketMessageFromProto(
  message: AdminSupportTicketMessage,
): SupportTicketMessage {
  return {
    id: Number(message.id),
    ticket_id: Number(message.ticketId),
    user_id: Number(message.userId),
    content: message.content,
    is_admin_reply: message.isAdminReply,
    created_at: message.createdAt,
    user: message.user ? supportTicketUserFromProto(message.user) : null,
    attachments: message.attachments.map(supportTicketAttachmentFromProto),
  };
}

function supportTicketUserFromProto(user: AdminSupportTicketUser): SupportTicketUser {
  return {
    id: Number(user.id),
    name: user.name ?? "",
    email: user.email,
    avatar_url: user.avatarUrl ?? null,
  };
}

function supportTicketAttachmentFromProto(
  attachment: AdminSupportTicketAttachment,
): SupportTicketAttachment {
  return {
    id: Number(attachment.id),
    original_name: attachment.originalName,
    mime_type: attachment.mimeType,
    size: Number(attachment.size),
  };
}
