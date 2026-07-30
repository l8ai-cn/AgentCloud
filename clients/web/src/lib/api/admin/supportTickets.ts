import {
  AdminAssignSupportTicketRequestSchema,
  AdminAssignSupportTicketResponseSchema,
  AdminGetSupportTicketAttachmentUrlRequestSchema,
  AdminGetSupportTicketAttachmentUrlResponseSchema,
  AdminGetSupportTicketRequestSchema,
  AdminListSupportTicketMessagesRequestSchema,
  AdminListSupportTicketMessagesResponseSchema,
  AdminListSupportTicketsRequestSchema,
  AdminListSupportTicketsResponseSchema,
  AdminReplySupportTicketRequestSchema,
  AdminSupportTicketDetailSchema,
  AdminSupportTicketMessageSchema,
  AdminUpdateSupportTicketStatusRequestSchema,
  AdminUpdateSupportTicketStatusResponseSchema,
  GetSupportTicketStatsRequestSchema,
  SupportTicketStatsSchema,
} from "@proto/support_ticket/v1/support_ticket_admin_pb";

import { callAdminConnect } from "./transport";
import {
  supportTicketFromProto,
  supportTicketMessageFromProto,
} from "./supportTicketConversion";
import type {
  SupportTicketDetail,
  SupportTicketListParams,
  SupportTicketMessage,
  SupportTicketPage,
  SupportTicketStats,
  SupportTicketStatus,
} from "./supportTicketTypes";

const SERVICE = "proto.support_ticket.v1.SupportTicketAdminService";

export async function listSupportTickets(
  params?: SupportTicketListParams,
): Promise<SupportTicketPage> {
  const response = await callAdminConnect(
    SERVICE,
    "ListSupportTickets",
    AdminListSupportTicketsRequestSchema,
    AdminListSupportTicketsResponseSchema,
    {
      search: params?.search,
      status: params?.status,
      category: params?.category,
      priority: params?.priority,
      page: params?.page,
      pageSize: params?.page_size,
    },
  );
  return {
    data: response.data.map(supportTicketFromProto),
    total: Number(response.total),
    page: response.page,
    page_size: response.pageSize,
    total_pages: response.totalPages,
  };
}

export async function getSupportTicketStats(): Promise<SupportTicketStats> {
  const response = await callAdminConnect(
    SERVICE,
    "GetSupportTicketStats",
    GetSupportTicketStatsRequestSchema,
    SupportTicketStatsSchema,
    {},
  );
  return {
    total: Number(response.total),
    open: Number(response.open),
    in_progress: Number(response.inProgress),
    resolved: Number(response.resolved),
    closed: Number(response.closed),
  };
}

export async function getSupportTicketDetail(id: number): Promise<SupportTicketDetail> {
  const [detail, messages] = await Promise.all([
    callAdminConnect(
      SERVICE,
      "GetSupportTicket",
      AdminGetSupportTicketRequestSchema,
      AdminSupportTicketDetailSchema,
      { id: BigInt(id) },
    ),
    callAdminConnect(
      SERVICE,
      "ListSupportTicketMessages",
      AdminListSupportTicketMessagesRequestSchema,
      AdminListSupportTicketMessagesResponseSchema,
      { id: BigInt(id) },
    ),
  ]);
  if (!detail.ticket) {
    throw new Error("Support ticket not found.");
  }
  return {
    ticket: supportTicketFromProto(detail.ticket),
    messages: messages.data.map(supportTicketMessageFromProto),
  };
}

export async function replySupportTicket(
  id: number,
  content: string,
): Promise<SupportTicketMessage> {
  const response = await callAdminConnect(
    SERVICE,
    "ReplySupportTicket",
    AdminReplySupportTicketRequestSchema,
    AdminSupportTicketMessageSchema,
    { id: BigInt(id), content },
  );
  return supportTicketMessageFromProto(response);
}

export async function updateSupportTicketStatus(
  id: number,
  status: SupportTicketStatus,
): Promise<void> {
  await callAdminConnect(
    SERVICE,
    "UpdateSupportTicketStatus",
    AdminUpdateSupportTicketStatusRequestSchema,
    AdminUpdateSupportTicketStatusResponseSchema,
    { id: BigInt(id), status },
  );
}

export async function assignSupportTicketToCurrentAdmin(id: number): Promise<void> {
  await callAdminConnect(
    SERVICE,
    "AssignSupportTicket",
    AdminAssignSupportTicketRequestSchema,
    AdminAssignSupportTicketResponseSchema,
    { id: BigInt(id) },
  );
}

export async function getSupportTicketAttachmentUrl(
  attachmentId: number,
): Promise<string> {
  const response = await callAdminConnect(
    SERVICE,
    "GetSupportTicketAttachmentUrl",
    AdminGetSupportTicketAttachmentUrlRequestSchema,
    AdminGetSupportTicketAttachmentUrlResponseSchema,
    { attachmentId: BigInt(attachmentId) },
  );
  return response.url;
}
