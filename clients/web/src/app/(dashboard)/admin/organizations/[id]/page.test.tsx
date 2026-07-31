import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getOrganization = vi.fn();
const getOrganizationMembers = vi.fn();
const getSubscription = vi.fn();
const listSubscriptionPlans = vi.fn();
const cancelSubscription = vi.fn();
const listRunners = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/api/admin/organizations", () => ({
  getOrganization: (...args: unknown[]) => getOrganization(...args),
  getOrganizationMembers: (...args: unknown[]) => getOrganizationMembers(...args),
  deleteOrganization: vi.fn(),
}));

vi.mock("@/lib/api/admin/subscriptions", () => ({
  getSubscription: (...args: unknown[]) => getSubscription(...args),
  listSubscriptionPlans: (...args: unknown[]) => listSubscriptionPlans(...args),
  cancelSubscription: (...args: unknown[]) => cancelSubscription(...args),
  createSubscription: vi.fn(),
  freezeSubscription: vi.fn(),
  renewSubscription: vi.fn(),
  setSubscriptionAutoRenew: vi.fn(),
  setSubscriptionQuota: vi.fn(),
  unfreezeSubscription: vi.fn(),
  updateSubscriptionCycle: vi.fn(),
  updateSubscriptionPlan: vi.fn(),
  updateSubscriptionSeats: vi.fn(),
}));

vi.mock("@/lib/api/admin/runners", () => ({
  listRunners: (...args: unknown[]) => listRunners(...args),
}));

import OrganizationDetailPage from "./page";

const organization = {
  id: 3,
  name: "Acme Inc",
  slug: "acme",
  logo_url: null,
  subscription_plan: "pro",
  subscription_status: "active",
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-20T00:00:00Z",
};

const member = {
  id: 1,
  user_id: 12,
  org_id: 3,
  role: "owner",
  joined_at: "2026-07-02T00:00:00Z",
  user: {
    id: 12,
    email: "owner@example.com",
    username: "owner",
    name: "Ada Lovelace",
    avatar_url: null,
  },
};

const plan = {
  id: 2,
  name: "pro",
  display_name: "Pro",
  price_per_seat_monthly: 20,
  price_per_seat_yearly: 200,
  included_pod_minutes: 1000,
  max_users: 20,
  max_runners: 10,
  max_concurrent_pods: 5,
  max_repositories: 10,
};

const subscription = {
  id: 11,
  organization_id: 3,
  plan_id: 2,
  status: "active",
  billing_cycle: "monthly",
  current_period_start: "2026-07-01T00:00:00Z",
  current_period_end: "2026-08-01T00:00:00Z",
  auto_renew: true,
  seat_count: 5,
  cancel_at_period_end: false,
  custom_quotas: { runners: 12 },
  plan,
  seat_usage: {
    total_seats: 5,
    used_seats: 2,
    available_seats: 3,
    max_seats: 20,
    can_add_seats: true,
  },
};

const runner = {
  id: 7,
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
  last_heartbeat: "2026-07-30T00:00:00Z",
  created_at: "2026-07-29T00:00:00Z",
  updated_at: "2026-07-30T00:00:00Z",
};

// The page unwraps route params with `use()`. A pending promise suspends the
// render and never resumes inside vitest's act scope, so hand it a thenable
// that is already marked fulfilled — the shape the App Router provides once
// params are known.
function routeParams(id: string) {
  const value = { id };
  return Object.assign(Promise.resolve(value), {
    status: "fulfilled",
    value,
  }) as Promise<{ id: string }>;
}

const renderPage = (id = "3") =>
  render(<OrganizationDetailPage params={routeParams(id)} />);

describe("OrganizationDetailPage", () => {
  beforeEach(() => {
    getOrganization.mockReset();
    getOrganizationMembers.mockReset();
    getSubscription.mockReset();
    listSubscriptionPlans.mockReset();
    cancelSubscription.mockReset();
    listRunners.mockReset();
    push.mockReset();
    getOrganization.mockResolvedValue(organization);
    getOrganizationMembers.mockResolvedValue([member]);
    getSubscription.mockResolvedValue(subscription);
    listSubscriptionPlans.mockResolvedValue([plan]);
    cancelSubscription.mockResolvedValue({ ...subscription, status: "canceled" });
    listRunners.mockResolvedValue({
      data: [runner],
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });
  });

  it("renders the profile, members, runners, and subscription panel", async () => {
    renderPage();

    expect(await screen.findByText("Acme Inc")).toBeInTheDocument();
    expect(screen.getByText("acme")).toBeInTheDocument();

    expect(screen.getByText("Members (1)")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("owner@example.com")).toBeInTheDocument();

    expect(await screen.findByText("node-alpha")).toBeInTheDocument();
    expect(screen.getByText("Runners (1)")).toBeInTheDocument();
    expect(listRunners).toHaveBeenCalledWith({ org_id: 3, page: 1, page_size: 10 });

    expect(
      screen.getByRole("heading", { name: "Subscription" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Plan and seats")).toBeInTheDocument();
    expect(screen.getByText("2 used, 3 available")).toBeInTheDocument();
    expect(screen.getByText("runners: 12")).toBeInTheDocument();
    expect(getSubscription).toHaveBeenCalledWith(3);
  });

  it("renders the create panel when the backend reports no subscription", async () => {
    getSubscription.mockResolvedValue(null);

    renderPage();

    expect(
      await screen.findByText("This organization has no subscription record."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create subscription" })).toBeEnabled();
    expect(screen.queryByText("Lifecycle")).not.toBeInTheDocument();
    expect(screen.queryByText("Custom quotas")).not.toBeInTheDocument();
  });

  it("requires confirmation before canceling the subscription", async () => {
    renderPage();
    await screen.findByText("Plan and seats");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(cancelSubscription).not.toHaveBeenCalled();
    expect(screen.getByText("Cancel subscription?")).toBeInTheDocument();
    expect(
      screen.getByText("Cancel this subscription and stop future renewals."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(cancelSubscription).toHaveBeenCalledWith(3));
    await waitFor(() => {
      expect(screen.queryByText("Cancel subscription?")).not.toBeInTheDocument();
    });
  });

  it("shows the backend error with a way back to the list", async () => {
    getOrganization.mockRejectedValue(new Error("organization query failed"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "organization query failed",
    );
    expect(
      screen.getByRole("link", { name: "Back to organizations" }),
    ).toHaveAttribute("href", "/admin/organizations");
  });

  it("rejects a non-numeric organization identifier", async () => {
    renderPage("not-an-id");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid organization identifier.",
    );
  });
});
