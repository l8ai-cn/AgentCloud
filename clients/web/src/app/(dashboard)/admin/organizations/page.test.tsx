import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listOrganizations = vi.fn();
const deleteOrganization = vi.fn();

vi.mock("@/lib/api/admin/organizations", () => ({
  listOrganizations: (...args: unknown[]) => listOrganizations(...args),
  deleteOrganization: (...args: unknown[]) => deleteOrganization(...args),
}));

import OrganizationsPage from "./page";

const acme = {
  id: 5,
  name: "Acme Inc",
  slug: "acme",
  logo_url: null,
  subscription_plan: "pro",
  subscription_status: "active",
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-20T00:00:00Z",
};

const globex = {
  id: 6,
  name: "Globex",
  slug: "globex",
  logo_url: null,
  subscription_plan: "",
  subscription_status: "",
  created_at: "2026-07-10T00:00:00Z",
  updated_at: "2026-07-20T00:00:00Z",
};

const response = {
  data: [acme, globex],
  total: 25,
  page: 1,
  page_size: 20,
  total_pages: 2,
};

describe("OrganizationsPage", () => {
  beforeEach(() => {
    listOrganizations.mockReset();
    deleteOrganization.mockReset();
    listOrganizations.mockResolvedValue(response);
    deleteOrganization.mockResolvedValue(undefined);
  });

  it("renders organization rows and the backend total", async () => {
    render(<OrganizationsPage />);

    expect(await screen.findByText("Acme Inc")).toBeInTheDocument();
    expect(screen.getByText("acme")).toBeInTheDocument();
    expect(screen.getByText("Globex")).toBeInTheDocument();
    expect(screen.getByText("25 organizations")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("pro")).toBeInTheDocument();
    expect(screen.getByText("no subscription")).toBeInTheDocument();
    expect(listOrganizations).toHaveBeenCalledWith({
      search: undefined,
      page: 1,
      page_size: 20,
    });
  });

  it("debounces search and resets pagination back to page one", async () => {
    render(<OrganizationsPage />);
    await screen.findByText("Acme Inc");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(listOrganizations).toHaveBeenLastCalledWith({
        search: undefined,
        page: 2,
        page_size: 20,
      });
    });

    fireEvent.change(screen.getByLabelText("Search organizations"), {
      target: { value: "  acme  " },
    });

    await waitFor(() => {
      expect(listOrganizations).toHaveBeenLastCalledWith({
        search: "acme",
        page: 1,
        page_size: 20,
      });
    });
  });

  it("requires confirmation before deleting an organization", async () => {
    render(<OrganizationsPage />);
    await screen.findByText("Acme Inc");

    fireEvent.click(screen.getByLabelText("Delete Acme Inc"));
    expect(deleteOrganization).not.toHaveBeenCalled();
    expect(screen.getByText("Delete this organization?")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Acme Inc and its tenant-owned resources will be permanently deleted.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete organization" }));

    await waitFor(() => expect(deleteOrganization).toHaveBeenCalledWith(5));
    await waitFor(() => {
      expect(screen.queryByText("Delete this organization?")).not.toBeInTheDocument();
    });
    expect(listOrganizations).toHaveBeenCalledTimes(2);
  });

  it("shows the backend error instead of an empty result", async () => {
    listOrganizations.mockRejectedValue(new Error("organization query failed"));

    render(<OrganizationsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "organization query failed",
    );
  });

  it("renders the empty state when no organizations match", async () => {
    listOrganizations.mockResolvedValue({
      ...response,
      data: [],
      total: 0,
      total_pages: 0,
    });

    render(<OrganizationsPage />);

    expect(await screen.findByText("No organizations found")).toBeInTheDocument();
    expect(screen.getByText("No tenant organizations exist yet.")).toBeInTheDocument();
  });
});
