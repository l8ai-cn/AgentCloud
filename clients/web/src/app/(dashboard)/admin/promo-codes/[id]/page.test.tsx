import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getPromoCode = vi.fn();
const listPromoCodeRedemptions = vi.fn();
const activatePromoCode = vi.fn();
const deactivatePromoCode = vi.fn();
const deletePromoCode = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/api/admin/promo", () => ({
  getPromoCode: (...args: unknown[]) => getPromoCode(...args),
  listPromoCodeRedemptions: (...args: unknown[]) => listPromoCodeRedemptions(...args),
  activatePromoCode: (...args: unknown[]) => activatePromoCode(...args),
  deactivatePromoCode: (...args: unknown[]) => deactivatePromoCode(...args),
  deletePromoCode: (...args: unknown[]) => deletePromoCode(...args),
  updatePromoCode: vi.fn(),
}));

import PromoCodeDetailPage from "./page";

const code = {
  id: 1,
  code: "LAUNCH30",
  name: "Launch campaign",
  description: "Three free months for launch partners",
  type: "campaign" as const,
  plan_name: "pro",
  duration_months: 3,
  max_uses: 100,
  used_count: 4,
  max_uses_per_org: 1,
  starts_at: "2026-07-01T00:00:00Z",
  expires_at: null,
  is_active: true,
  created_by_id: 7,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-02T00:00:00Z",
};

const redemption = {
  id: 9,
  promo_code_id: 1,
  organization_id: 4,
  organization_name: "Acme Inc",
  organization_slug: "acme",
  user_id: 12,
  user_email: "owner@example.com",
  user_username: "owner",
  plan_name: "pro",
  duration_months: 3,
  new_period_end: "2026-10-01T00:00:00Z",
  ip_address: null,
  created_at: "2026-07-05T00:00:00Z",
};

const redemptionPage = {
  data: [redemption],
  total: 1,
  page: 1,
  page_size: 20,
  total_pages: 1,
};

const noRedemptions = { ...redemptionPage, data: [], total: 0, total_pages: 0 };

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

const renderPage = (id = "1") =>
  render(<PromoCodeDetailPage params={routeParams(id)} />);

describe("PromoCodeDetailPage", () => {
  beforeEach(() => {
    getPromoCode.mockReset();
    listPromoCodeRedemptions.mockReset();
    activatePromoCode.mockReset();
    deactivatePromoCode.mockReset();
    deletePromoCode.mockReset();
    push.mockReset();
    getPromoCode.mockResolvedValue(code);
    listPromoCodeRedemptions.mockResolvedValue(redemptionPage);
    activatePromoCode.mockResolvedValue({ message: "activated" });
    deactivatePromoCode.mockResolvedValue({ message: "deactivated" });
    deletePromoCode.mockResolvedValue({ message: "deleted" });
  });

  it("renders the promo code summary and its redemptions", async () => {
    renderPage();

    expect(await screen.findByText("LAUNCH30")).toBeInTheDocument();
    expect(screen.getByText("Launch campaign")).toBeInTheDocument();
    expect(screen.getByText("3 months of pro")).toBeInTheDocument();
    expect(screen.getByText("Campaign")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("4 / 100")).toBeInTheDocument();
    expect(screen.getByText("1 per organization")).toBeInTheDocument();
    expect(getPromoCode).toHaveBeenCalledWith(1);

    expect(await screen.findByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getByText("Redemptions")).toBeInTheDocument();
    expect(screen.getByText("1 recorded uses")).toBeInTheDocument();
    expect(screen.getByText("@owner")).toBeInTheDocument();
    expect(screen.getByText("Acme Inc")).toBeInTheDocument();
    expect(listPromoCodeRedemptions).toHaveBeenCalledWith(1, {
      page: 1,
      page_size: 20,
    });
  });

  it("blocks deletion while redemptions exist", async () => {
    renderPage();
    await screen.findByText("owner@example.com");

    const deleteButton = screen.getByRole("button", { name: "Delete" });
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAttribute(
      "title",
      "Codes with redemptions cannot be deleted",
    );
  });

  it("requires confirmation before deactivating an active code", async () => {
    renderPage();
    await screen.findByText("LAUNCH30");

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(deactivatePromoCode).not.toHaveBeenCalled();
    expect(screen.getByText("Deactivate this promo code?")).toBeInTheDocument();
    expect(
      screen.getByText("LAUNCH30 will stop accepting new redemptions."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(deactivatePromoCode).toHaveBeenCalledWith(1));
    await waitFor(() => expect(getPromoCode).toHaveBeenCalledTimes(2));
    expect(activatePromoCode).not.toHaveBeenCalled();
  });

  it("requires confirmation before activating an inactive code", async () => {
    getPromoCode.mockResolvedValue({ ...code, is_active: false });
    renderPage();
    await screen.findByText("LAUNCH30");

    fireEvent.click(screen.getByRole("button", { name: "Activate" }));
    expect(activatePromoCode).not.toHaveBeenCalled();
    expect(screen.getByText("Activate this promo code?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(activatePromoCode).toHaveBeenCalledWith(1));
    expect(deactivatePromoCode).not.toHaveBeenCalled();
  });

  it("requires confirmation before deleting and returns to the list", async () => {
    listPromoCodeRedemptions.mockResolvedValue(noRedemptions);
    renderPage();
    await screen.findByText("No redemptions");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(deletePromoCode).not.toHaveBeenCalled();
    expect(screen.getByText("Delete this promo code?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete code" }));

    await waitFor(() => {
      expect(deletePromoCode).toHaveBeenCalledWith(1);
      expect(push).toHaveBeenCalledWith("/admin/promo-codes");
    });
  });

  it("shows the backend error with a way back to the list", async () => {
    getPromoCode.mockRejectedValue(new Error("promo code query failed"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "promo code query failed",
    );
    expect(
      screen.getByRole("link", { name: "Back to promo codes" }),
    ).toHaveAttribute("href", "/admin/promo-codes");
  });

  it("rejects a non-numeric promo code identifier", async () => {
    renderPage("not-an-id");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid promo code identifier.",
    );
    expect(getPromoCode).not.toHaveBeenCalled();
  });
});
