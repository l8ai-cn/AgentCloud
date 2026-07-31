import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listUsers = vi.fn();

vi.mock("@/lib/api/admin/users", () => ({
  listUsers: (...args: unknown[]) => listUsers(...args),
  disableUser: vi.fn(),
  enableUser: vi.fn(),
  grantAdmin: vi.fn(),
  revokeAdmin: vi.fn(),
  verifyUserEmail: vi.fn(),
  unverifyUserEmail: vi.fn(),
}));

vi.mock("@/stores/auth", () => ({
  useCurrentUser: () => ({ id: 1 }),
}));

import AdminUsersPage from "./page";

const response = {
  data: [
    {
      id: 2,
      email: "operator@example.com",
      username: "operator",
      name: "Operator",
      avatar_url: null,
      is_active: true,
      is_system_admin: false,
      is_email_verified: true,
      last_login_at: null,
      created_at: "2026-07-30T00:00:00Z",
      updated_at: "2026-07-30T00:00:00Z",
    },
  ],
  total: 1,
  page: 1,
  page_size: 20,
  total_pages: 1,
};

describe("AdminUsersPage", () => {
  beforeEach(() => {
    listUsers.mockReset();
    listUsers.mockResolvedValue(response);
  });

  it("renders the user list and total", async () => {
    render(<AdminUsersPage />);

    expect(await screen.findByText("Operator")).toBeInTheDocument();
    expect(screen.getByText("1 users")).toBeInTheDocument();
    expect(screen.getByText("operator@example.com")).toBeInTheDocument();
  });

  it("debounces search and resets to page one", async () => {
    render(<AdminUsersPage />);
    await screen.findByText("Operator");

    fireEvent.change(screen.getByLabelText("Search users"), {
      target: { value: "operator" },
    });

    await waitFor(() => {
      expect(listUsers).toHaveBeenLastCalledWith({
        search: "operator",
        page: 1,
        page_size: 20,
      });
    });
  });

  it("shows the backend error instead of an empty result", async () => {
    listUsers.mockRejectedValue(new Error("database unavailable"));

    render(<AdminUsersPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("database unavailable");
  });
});
