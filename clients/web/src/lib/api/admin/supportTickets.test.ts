import { beforeEach, describe, expect, it, vi } from "vitest";

const callAdminConnect = vi.fn();

vi.mock("./transport", () => ({
  callAdminConnect: (...args: unknown[]) => callAdminConnect(...args),
}));

import {
  assignSupportTicketToCurrentAdmin,
  getSupportTicketAttachmentUrl,
  getSupportTicketDetail,
  getSupportTicketStats,
  listSupportTickets,
  replySupportTicket,
  updateSupportTicketStatus,
} from "./supportTickets";

const ticket = {
  id: 7n,
  userId: 12n,
  title: "Runner cannot connect",
  category: "bug",
  status: "open",
  priority: "high",
  assignedAdminId: undefined,
  createdAt: "2026-07-30T00:00:00Z",
  updatedAt: "2026-07-30T00:00:00Z",
  resolvedAt: undefined,
};

const message = {
  id: 9n,
  ticketId: 7n,
  userId: 12n,
  content: "Connection fails after registration.",
  isAdminReply: false,
  createdAt: "2026-07-30T00:01:00Z",
  user: { id: 12n, name: "User", email: "user@example.com", avatarUrl: undefined },
  attachments: [
    { id: 3n, originalName: "runner.log", mimeType: "text/plain", size: 128n },
  ],
};

describe("support ticket admin API", () => {
  beforeEach(() => callAdminConnect.mockReset());

  it("maps list filters, pagination, and ticket fields", async () => {
    callAdminConnect.mockResolvedValue({
      data: [ticket],
      total: 21n,
      page: 2,
      pageSize: 20,
      totalPages: 2,
    });

    const result = await listSupportTickets({
      search: "runner",
      status: "open",
      category: "bug",
      priority: "high",
      page: 2,
      page_size: 20,
    });

    expect(callAdminConnect).toHaveBeenCalledWith(
      "proto.support_ticket.v1.SupportTicketAdminService",
      "ListSupportTickets",
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ priority: "high", pageSize: 20 }),
    );
    expect(result).toMatchObject({
      total: 21,
      total_pages: 2,
      data: [{ id: 7, assigned_admin_id: null }],
    });
  });

  it("loads messages through the dedicated RPC and maps attachments", async () => {
    callAdminConnect
      .mockResolvedValueOnce({ ticket, messages: [] })
      .mockResolvedValueOnce({ data: [message] });

    const result = await getSupportTicketDetail(7);

    expect(callAdminConnect).toHaveBeenNthCalledWith(
      2,
      "proto.support_ticket.v1.SupportTicketAdminService",
      "ListSupportTicketMessages",
      expect.anything(),
      expect.anything(),
      { id: 7n },
    );
    expect(result.messages[0]).toMatchObject({
      id: 9,
      user: { email: "user@example.com" },
      attachments: [{ id: 3, original_name: "runner.log", size: 128 }],
    });
  });

  it("does not hide a message loading failure", async () => {
    callAdminConnect
      .mockResolvedValueOnce({ ticket, messages: [] })
      .mockRejectedValueOnce(new Error("message query failed"));

    await expect(getSupportTicketDetail(7)).rejects.toThrow("message query failed");
  });

  it("maps stats and mutation inputs to the real RPCs", async () => {
    callAdminConnect
      .mockResolvedValueOnce({ total: 4n, open: 1n, inProgress: 1n, resolved: 1n, closed: 1n })
      .mockResolvedValueOnce(message)
      .mockResolvedValueOnce({ message: "Status updated" })
      .mockResolvedValueOnce({ message: "Ticket assigned" })
      .mockResolvedValueOnce({ url: "https://storage.example/runner.log" });

    await expect(getSupportTicketStats()).resolves.toEqual({
      total: 4,
      open: 1,
      in_progress: 1,
      resolved: 1,
      closed: 1,
    });
    await replySupportTicket(7, "Investigating now.");
    await updateSupportTicketStatus(7, "in_progress");
    await assignSupportTicketToCurrentAdmin(7);
    await expect(getSupportTicketAttachmentUrl(3)).resolves.toContain("runner.log");

    expect(callAdminConnect.mock.calls.map((call) => call[1])).toEqual([
      "GetSupportTicketStats",
      "ReplySupportTicket",
      "UpdateSupportTicketStatus",
      "AssignSupportTicket",
      "GetSupportTicketAttachmentUrl",
    ]);
    expect(callAdminConnect.mock.calls[3][4]).toEqual({ id: 7n });
  });
});
