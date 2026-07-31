import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listRunners = vi.fn();

vi.mock("@/lib/api/admin/runners", () => ({
  listRunners: (...args: unknown[]) => listRunners(...args),
}));

import { OrganizationRunners } from "./OrganizationRunners";

const runner = {
  id: 2,
  organization_id: 3,
  node_id: "node-alpha",
  description: "Primary Linux host",
  status: "online",
  is_enabled: true,
  runner_version: "1.2.3",
  current_pods: 1,
  max_concurrent_pods: 10,
  available_agents: ["codex", "gemini"],
  host_info: null,
  last_heartbeat: "2026-07-30T00:00:00Z",
  created_at: "2026-07-29T00:00:00Z",
  updated_at: "2026-07-30T00:00:00Z",
};

const response = {
  data: [runner],
  total: 1,
  page: 1,
  page_size: 10,
  total_pages: 1,
};

describe("OrganizationRunners", () => {
  beforeEach(() => {
    listRunners.mockReset();
    listRunners.mockResolvedValue(response);
  });

  it("filters runners by organization and exposes expandable status details", async () => {
    render(<OrganizationRunners orgId={3} />);

    expect(await screen.findByText("node-alpha")).toBeInTheDocument();
    expect(listRunners).toHaveBeenCalledWith({ org_id: 3, page: 1, page_size: 10 });
    expect(screen.getByText("online")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Runner management/ })).toHaveAttribute(
      "href",
      "/admin/runners",
    );

    const details = screen.getByText("node-alpha").closest("details");
    expect(details).not.toHaveAttribute("open");
    fireEvent.click(details!.querySelector("summary")!);
    expect(details).toHaveAttribute("open");
    expect(screen.getByText("Primary Linux host")).toBeInTheDocument();
    expect(screen.getByText("codex, gemini")).toBeInTheDocument();
  });

  it("shows a loading state while the request is pending", () => {
    listRunners.mockReturnValue(new Promise(() => undefined));

    render(<OrganizationRunners orgId={3} />);

    expect(screen.getByLabelText("Loading runners")).toBeInTheDocument();
  });

  it("shows the organization empty state", async () => {
    listRunners.mockResolvedValue({ ...response, data: [], total: 0 });

    render(<OrganizationRunners orgId={3} />);

    expect(await screen.findByText("No runners")).toBeInTheDocument();
  });

  it("shows the backend error and retries the request", async () => {
    listRunners
      .mockRejectedValueOnce(new Error("runner query unavailable"))
      .mockResolvedValueOnce(response);

    render(<OrganizationRunners orgId={3} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("runner query unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(listRunners).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("node-alpha")).toBeInTheDocument();
  });
});
