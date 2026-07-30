import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listPromoCodes = vi.fn();
const activatePromoCode = vi.fn();
const deactivatePromoCode = vi.fn();
const deletePromoCode = vi.fn();

vi.mock("@/lib/api/admin/promo", () => ({
  listPromoCodes: (...args: unknown[]) => listPromoCodes(...args),
  activatePromoCode: (...args: unknown[]) => activatePromoCode(...args),
  deactivatePromoCode: (...args: unknown[]) => deactivatePromoCode(...args),
  deletePromoCode: (...args: unknown[]) => deletePromoCode(...args),
}));

import AdminPromoCodesPage from "./page";

const code = {
  id: 1,
  code: "LAUNCH30",
  name: "Launch campaign",
  description: "",
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
  updated_at: "2026-07-01T00:00:00Z",
};

const response = {
  data: [code],
  total: 1,
  page: 1,
  page_size: 20,
  total_pages: 1,
};

describe("AdminPromoCodesPage", () => {
  beforeEach(() => {
    listPromoCodes.mockReset();
    listPromoCodes.mockResolvedValue(response);
    activatePromoCode.mockReset();
    deactivatePromoCode.mockReset();
    deletePromoCode.mockReset();
  });

  it("renders promo codes and backend status", async () => {
    render(<AdminPromoCodesPage />);

    expect(await screen.findByText("LAUNCH30")).toBeInTheDocument();
    expect(screen.getByText("Launch campaign")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("1 promo codes")).toBeInTheDocument();
  });

  it("debounces search and resets pagination filters", async () => {
    render(<AdminPromoCodesPage />);
    await screen.findByText("LAUNCH30");

    fireEvent.change(screen.getByLabelText("Search promo codes"), {
      target: { value: "partner" },
    });

    await waitFor(() => {
      expect(listPromoCodes).toHaveBeenLastCalledWith({
        search: "partner",
        type: undefined,
        plan_name: undefined,
        is_active: undefined,
        page: 1,
        page_size: 20,
      });
    });
  });

  it("shows a load error instead of presenting an empty result", async () => {
    listPromoCodes.mockRejectedValue(new Error("database unavailable"));

    render(<AdminPromoCodesPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "database unavailable",
    );
  });

  it("confirms deactivation before calling the backend", async () => {
    const user = userEvent.setup();
    deactivatePromoCode.mockResolvedValue({ message: "deactivated" });
    render(<AdminPromoCodesPage />);
    await screen.findByText("LAUNCH30");

    await user.click(screen.getByLabelText("Actions for LAUNCH30"));
    await user.click(await screen.findByRole("menuitem", { name: "Deactivate" }));
    expect(screen.getByText("Deactivate this promo code?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(deactivatePromoCode).toHaveBeenCalledWith(1));
  });
});
