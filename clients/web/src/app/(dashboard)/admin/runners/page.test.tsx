import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listRunners = vi.fn();
const deleteRunner = vi.fn();

vi.mock("@/lib/api/admin/runners", () => ({
  listRunners: (...args: unknown[]) => listRunners(...args),
  disableRunner: vi.fn(),
  enableRunner: vi.fn(),
  deleteRunner: (...args: unknown[]) => deleteRunner(...args),
}));

import AdminRunnersPage from "./page";

const runner = {
  id: 2,
  organization_id: 3,
  node_id: "node-alpha",
  description: null,
  status: "online",
  is_enabled: true,
  runner_version: "1.2.3",
  current_pods: 1,
  max_concurrent_pods: 10,
  available_agents: ["codex"],
  host_info: null,
  last_heartbeat: null,
  created_at: "2026-07-30T00:00:00Z",
  updated_at: "2026-07-30T00:00:00Z",
  organization: { id: 3, name: "Acme", slug: "acme" },
};

const response = {
  data: [runner],
  total: 1,
  page: 1,
  page_size: 20,
  total_pages: 1,
};

describe("AdminRunnersPage", () => {
  beforeEach(() => {
    listRunners.mockReset();
    deleteRunner.mockReset();
    listRunners.mockResolvedValue(response);
    deleteRunner.mockResolvedValue({ message: "Runner deleted" });
  });

  it("renders the runner list and total", async () => {
    render(<AdminRunnersPage />);

    expect(await screen.findByText("node-alpha")).toBeInTheDocument();
    expect(screen.getByText("1 runners")).toBeInTheDocument();
    expect(screen.getByText("online")).toBeInTheDocument();
  });

  it("debounces search and resets to page one", async () => {
    render(<AdminRunnersPage />);
    await screen.findByText("node-alpha");

    fireEvent.change(screen.getByLabelText("Search runners"), {
      target: { value: "alpha" },
    });

    await waitFor(() => {
      expect(listRunners).toHaveBeenLastCalledWith({
        search: "alpha",
        page: 1,
        page_size: 20,
      });
    });
  });

  it("shows the backend error instead of an empty result", async () => {
    listRunners.mockRejectedValue(new Error("database unavailable"));

    render(<AdminRunnersPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("database unavailable");
  });

  it("requires confirmation before deleting a runner", async () => {
    render(<AdminRunnersPage />);
    await screen.findByText("node-alpha");

    fireEvent.click(screen.getByLabelText("Delete node-alpha"));
    expect(deleteRunner).not.toHaveBeenCalled();
    expect(screen.getByText("Delete this runner?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(deleteRunner).toHaveBeenCalledWith(2);
    });
    await waitFor(() => {
      expect(screen.queryByText("Delete this runner?")).not.toBeInTheDocument();
    });
  });

  it("renders an empty state when no runners match", async () => {
    listRunners.mockResolvedValue({ ...response, data: [], total: 0 });

    render(<AdminRunnersPage />);

    expect(await screen.findByText("No runners found")).toBeInTheDocument();
  });
});
