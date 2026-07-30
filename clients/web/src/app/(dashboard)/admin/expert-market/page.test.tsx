import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listExpertReleases = vi.fn();

vi.mock("@/lib/api/admin/expertMarket", () => ({
  listExpertReleases: (...args: unknown[]) => listExpertReleases(...args),
  getExpertRelease: vi.fn(),
  approveExpertRelease: vi.fn(),
  rejectExpertRelease: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import ExpertMarketPage from "./page";

const release = {
  id: 7,
  application_slug: "video-expert",
  version: 3,
  status: "pending" as const,
  name: "Video Expert",
  summary: "Summary",
  description: "Description",
  category: "media",
  tags: ["video"],
  outcomes: ["render"],
  featured: false,
  expert_snapshot_json: "{}",
  worker_spec_snapshot_json: "{}",
  skill_dependencies_json: "[]",
  created_at: "2026-07-30T00:00:00Z",
};

describe("ExpertMarketPage", () => {
  beforeEach(() => {
    listExpertReleases.mockReset();
    listExpertReleases.mockResolvedValue({
      data: [release],
      total: 45,
      limit: 20,
      offset: 0,
    });
  });

  it("loads and navigates all expert release pages", async () => {
    listExpertReleases
      .mockResolvedValueOnce({
        data: [release],
        total: 45,
        limit: 20,
        offset: 0,
      })
      .mockResolvedValueOnce({
        data: [{ ...release, id: 27, name: "Second Page Expert" }],
        total: 45,
        limit: 20,
        offset: 20,
      });

    render(<ExpertMarketPage />);

    expect(await screen.findByText("Video Expert")).toBeInTheDocument();
    expect(listExpertReleases).toHaveBeenLastCalledWith("pending", 20, 0);
    expect(screen.getByText("Showing 1-20 of 45")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("Second Page Expert")).toBeInTheDocument();
    expect(listExpertReleases).toHaveBeenLastCalledWith("pending", 20, 20);
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("resets pagination when the status changes", async () => {
    render(<ExpertMarketPage />);
    await screen.findByText("Video Expert");

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => {
      expect(listExpertReleases).toHaveBeenLastCalledWith("pending", 20, 20);
    });

    fireEvent.click(screen.getByRole("button", { name: "published" }));

    await waitFor(() => {
      expect(listExpertReleases).toHaveBeenLastCalledWith("published", 20, 0);
    });
  });
});
