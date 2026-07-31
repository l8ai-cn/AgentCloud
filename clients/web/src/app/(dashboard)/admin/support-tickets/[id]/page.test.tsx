import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSupportTicketDetail = vi.fn();
const replySupportTicket = vi.fn();
const updateSupportTicketStatus = vi.fn();
const assignSupportTicketToCurrentAdmin = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "7" }),
}));

vi.mock("@/lib/api/admin/supportTickets", () => ({
  getSupportTicketDetail: (...args: unknown[]) => getSupportTicketDetail(...args),
  replySupportTicket: (...args: unknown[]) => replySupportTicket(...args),
  updateSupportTicketStatus: (...args: unknown[]) => updateSupportTicketStatus(...args),
  assignSupportTicketToCurrentAdmin: (...args: unknown[]) =>
    assignSupportTicketToCurrentAdmin(...args),
  getSupportTicketAttachmentUrl: vi.fn(),
}));

import SupportTicketDetailPage from "./page";

const detail = {
  ticket: {
    id: 7,
    user_id: 12,
    title: "Runner cannot connect",
    category: "bug",
    status: "open",
    priority: "high",
    assigned_admin_id: null,
    created_at: "2026-07-30T00:00:00Z",
    updated_at: "2026-07-30T00:00:00Z",
    resolved_at: null,
  },
  messages: [
    {
      id: 9,
      ticket_id: 7,
      user_id: 12,
      content: "Connection fails after registration.",
      is_admin_reply: false,
      created_at: "2026-07-30T00:01:00Z",
      user: { id: 12, name: "User", email: "user@example.com", avatar_url: null },
      attachments: [],
    },
  ],
};

describe("SupportTicketDetailPage", () => {
  beforeEach(() => {
    getSupportTicketDetail.mockReset();
    replySupportTicket.mockReset();
    updateSupportTicketStatus.mockReset();
    assignSupportTicketToCurrentAdmin.mockReset();
    getSupportTicketDetail.mockResolvedValue(detail);
    replySupportTicket.mockResolvedValue({});
    updateSupportTicketStatus.mockResolvedValue(undefined);
    assignSupportTicketToCurrentAdmin.mockResolvedValue(undefined);
  });

  it("renders ticket metadata and conversation", async () => {
    render(<SupportTicketDetailPage />);

    expect(await screen.findByText("Runner cannot connect")).toBeInTheDocument();
    expect(screen.getByText("Connection fails after registration.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign to me" })).toBeEnabled();
  });

  it("sends a text reply and reloads the detail", async () => {
    render(<SupportTicketDetailPage />);
    await screen.findByText("Connection fails after registration.");

    fireEvent.change(screen.getByLabelText("Admin reply"), {
      target: { value: "Investigating now." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() => {
      expect(replySupportTicket).toHaveBeenCalledWith(7, "Investigating now.");
      expect(getSupportTicketDetail).toHaveBeenCalledTimes(2);
    });
  });

  it("shows detail loading failures", async () => {
    getSupportTicketDetail.mockRejectedValue(new Error("message query failed"));

    render(<SupportTicketDetailPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("message query failed");
  });
});
