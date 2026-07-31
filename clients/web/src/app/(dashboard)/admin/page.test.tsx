import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getDashboardStats = vi.fn();

vi.mock("@/lib/api/admin/dashboard", () => ({
  getDashboardStats: (...args: unknown[]) => getDashboardStats(...args),
}));

import AdminOverviewPage from "./page";

const stats = {
  total_users: 42,
  active_users: 30,
  total_organizations: 8,
  total_runners: 5,
  online_runners: 3,
  total_pods: 120,
  active_pods: 12,
  total_subscriptions: 6,
  active_subscriptions: 4,
  new_users_today: 2,
  new_users_this_week: 9,
  new_users_this_month: 21,
};

describe("AdminOverviewPage", () => {
  beforeEach(() => {
    getDashboardStats.mockReset();
    getDashboardStats.mockResolvedValue(stats);
  });

  it("renders every stat card from the backend payload", async () => {
    render(<AdminOverviewPage />);

    expect(await screen.findByText("Users")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("30 active")).toBeInTheDocument();

    expect(screen.getByText("Organizations")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("4 active subscriptions")).toBeInTheDocument();

    expect(screen.getByText("Runners")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3 online")).toBeInTheDocument();

    expect(screen.getByText("Active pods")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("120 total")).toBeInTheDocument();
  });

  it("renders the user growth breakdown", async () => {
    render(<AdminOverviewPage />);

    expect(await screen.findByText("User growth")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("Last month")).toBeInTheDocument();
    expect(screen.getByText("21")).toBeInTheDocument();
  });

  it("shows the loading state until the stats resolve", async () => {
    let resolveStats: (value: typeof stats) => void = () => {};
    getDashboardStats.mockReturnValue(
      new Promise<typeof stats>((resolve) => {
        resolveStats = resolve;
      }),
    );

    render(<AdminOverviewPage />);

    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    expect(screen.queryByText("Users")).not.toBeInTheDocument();
    expect(screen.queryByText("User growth")).not.toBeInTheDocument();

    resolveStats(stats);

    expect(await screen.findByText("Users")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
  });

  it("shows the backend error instead of empty stat cards", async () => {
    getDashboardStats.mockRejectedValue(new Error("statistics service unavailable"));

    render(<AdminOverviewPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "statistics service unavailable",
    );
    expect(screen.queryByText("Users")).not.toBeInTheDocument();
  });

  it("falls back to the translated error when the rejection carries no message", async () => {
    getDashboardStats.mockRejectedValue({});

    render(<AdminOverviewPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to load system statistics.",
    );
  });

  it("re-invokes the API when refresh is clicked", async () => {
    render(<AdminOverviewPage />);
    await screen.findByText("42");
    expect(getDashboardStats).toHaveBeenCalledTimes(1);

    getDashboardStats.mockResolvedValue({ ...stats, total_users: 99 });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(getDashboardStats).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("99")).toBeInTheDocument();
  });

  it("clears a previous error after a successful refresh", async () => {
    getDashboardStats.mockRejectedValueOnce(new Error("statistics service unavailable"));

    render(<AdminOverviewPage />);
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
