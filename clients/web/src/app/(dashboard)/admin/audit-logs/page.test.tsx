import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listAuditLogs = vi.fn();

vi.mock("@/lib/api/admin/auditLogs", () => ({
  listAuditLogs: (...args: unknown[]) => listAuditLogs(...args),
}));

import AuditLogsPage from "./page";

const namedAdmin = {
  id: 5,
  email: "ada@agentcloud.local",
  username: "ada",
  name: "Ada Admin",
  avatar_url: null,
};

const logs = [
  {
    id: 1,
    admin_user_id: 5,
    action: "user.disable",
    target_type: "user",
    target_id: 12,
    old_data: null,
    new_data: null,
    ip_address: "10.0.0.1",
    user_agent: null,
    created_at: "2026-07-30T00:00:00Z",
    admin_user: namedAdmin,
  },
  {
    id: 2,
    admin_user_id: 6,
    action: "runner.delete",
    target_type: "runner",
    target_id: 7,
    old_data: null,
    new_data: null,
    ip_address: null,
    user_agent: null,
    created_at: "2026-07-30T01:00:00Z",
    admin_user: { ...namedAdmin, id: 6, username: "ops-bot", name: null },
  },
];

const response = {
  data: logs,
  total: 2,
  page: 1,
  page_size: 50,
  total_pages: 1,
};

describe("AuditLogsPage", () => {
  beforeEach(() => {
    listAuditLogs.mockReset();
    listAuditLogs.mockResolvedValue(response);
  });

  it("renders the audit log entries and total", async () => {
    render(<AuditLogsPage />);

    expect(await screen.findByText("user.disable")).toBeInTheDocument();
    expect(screen.getByText("user #12")).toBeInTheDocument();
    expect(screen.getByText("by Ada Admin")).toBeInTheDocument();
    expect(screen.getByText("from 10.0.0.1")).toBeInTheDocument();

    expect(screen.getByText("runner.delete")).toBeInTheDocument();
    expect(screen.getByText("runner #7")).toBeInTheDocument();
    expect(screen.getByText("by ops-bot")).toBeInTheDocument();

    expect(screen.getByText("Audit Logs (2)")).toBeInTheDocument();
  });

  it("queries the first page with the default page size", async () => {
    render(<AuditLogsPage />);
    await screen.findByText("user.disable");

    expect(listAuditLogs).toHaveBeenCalledWith({
      page: 1,
      page_size: 50,
      target_type: undefined,
    });
  });

  it("renders an empty state when no audit logs exist", async () => {
    listAuditLogs.mockResolvedValue({ ...response, data: [], total: 0 });

    render(<AuditLogsPage />);

    expect(await screen.findByText("No audit logs")).toBeInTheDocument();
    expect(screen.getByText("Audit Logs (0)")).toBeInTheDocument();
  });

  it("shows the backend error instead of an empty result", async () => {
    listAuditLogs.mockRejectedValue(new Error("database unavailable"));

    render(<AuditLogsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("database unavailable");
    expect(screen.queryByText("No audit logs")).not.toBeInTheDocument();
  });

  it("falls back to the translated error when the rejection carries no message", async () => {
    listAuditLogs.mockRejectedValue({});

    render(<AuditLogsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to load audit logs.",
    );
  });

  it("re-fetches the current page when refresh is clicked", async () => {
    render(<AuditLogsPage />);
    await screen.findByText("user.disable");
    expect(listAuditLogs).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(listAuditLogs).toHaveBeenCalledTimes(2);
    });
    expect(listAuditLogs).toHaveBeenLastCalledWith({
      page: 1,
      page_size: 50,
      target_type: undefined,
    });
  });

  it("filters by target type and resets to the first page", async () => {
    listAuditLogs.mockImplementation((params: { page?: number }) =>
      Promise.resolve({ ...response, page: params.page ?? 1, total_pages: 3 }),
    );

    render(<AuditLogsPage />);
    await screen.findByText("user.disable");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Page 2 of 3");

    fireEvent.click(screen.getByRole("button", { name: "Runners" }));

    await waitFor(() => {
      expect(listAuditLogs).toHaveBeenLastCalledWith({
        page: 1,
        page_size: 50,
        target_type: "runner",
      });
    });
  });

  describe("pagination", () => {
    beforeEach(() => {
      listAuditLogs.mockImplementation((params: { page?: number }) =>
        Promise.resolve({
          data: logs,
          total: 120,
          page: params.page ?? 1,
          page_size: 50,
          total_pages: 3,
        }),
      );
    });

    it("hides the controls for a single page of results", async () => {
      listAuditLogs.mockResolvedValue(response);

      render(<AuditLogsPage />);
      await screen.findByText("user.disable");

      expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
    });

    it("disables previous on the first page", async () => {
      render(<AuditLogsPage />);
      await screen.findByText("Page 1 of 3");

      expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    });

    it("advances to the next page and re-queries", async () => {
      render(<AuditLogsPage />);
      await screen.findByText("Page 1 of 3");

      fireEvent.click(screen.getByRole("button", { name: "Next" }));

      await waitFor(() => {
        expect(listAuditLogs).toHaveBeenLastCalledWith({
          page: 2,
          page_size: 50,
          target_type: undefined,
        });
      });
      expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    });

    it("returns to the previous page and disables next on the last page", async () => {
      render(<AuditLogsPage />);
      await screen.findByText("Page 1 of 3");

      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      await screen.findByText("Page 2 of 3");
      fireEvent.click(screen.getByRole("button", { name: "Next" }));
      await screen.findByText("Page 3 of 3");

      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

      fireEvent.click(screen.getByRole("button", { name: "Previous" }));

      await waitFor(() => {
        expect(listAuditLogs).toHaveBeenLastCalledWith({
          page: 2,
          page_size: 50,
          target_type: undefined,
        });
      });
      expect(await screen.findByText("Page 2 of 3")).toBeInTheDocument();
    });
  });
});
