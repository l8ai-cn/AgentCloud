import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listSupportTickets = vi.fn();
const getSupportTicketStats = vi.fn();

vi.mock("@/lib/api/admin/supportTickets", () => ({
  listSupportTickets: (...args: unknown[]) => listSupportTickets(...args),
  getSupportTicketStats: (...args: unknown[]) => getSupportTicketStats(...args),
}));

import SupportTicketsPage from "./page";

const response = {
  data: [
    {
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
  ],
  total: 1,
  page: 1,
  page_size: 20,
  total_pages: 1,
};

describe("SupportTicketsPage", () => {
  beforeEach(() => {
    listSupportTickets.mockReset();
    getSupportTicketStats.mockReset();
    listSupportTickets.mockResolvedValue(response);
    getSupportTicketStats.mockResolvedValue({
      total: 1,
      open: 1,
      in_progress: 0,
      resolved: 0,
      closed: 0,
    });
  });

  it("renders stats and the ticket list", async () => {
    render(<SupportTicketsPage />);

    expect(await screen.findByText("Runner cannot connect")).toBeInTheDocument();
    expect(screen.getByText("1 tickets")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("debounces search and preserves all filter contracts", async () => {
    render(<SupportTicketsPage />);
    await screen.findByText("Runner cannot connect");

    fireEvent.change(screen.getByLabelText("Search support tickets"), {
      target: { value: "runner" },
    });

    await waitFor(() => {
      expect(listSupportTickets).toHaveBeenLastCalledWith({
        search: "runner",
        status: undefined,
        category: undefined,
        priority: undefined,
        page: 1,
        page_size: 20,
      });
    });
  });

  it("shows a backend failure instead of an empty state", async () => {
    listSupportTickets.mockRejectedValue(new Error("database unavailable"));

    render(<SupportTicketsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("database unavailable");
  });
});
