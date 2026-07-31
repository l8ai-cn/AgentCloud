import { fireEvent, render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { CreatePromoCodeForm } from "./CreatePromoCodeForm";

describe("CreatePromoCodeForm", () => {
  it("normalizes and submits the backend-supported fields", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreatePromoCodeForm saving={false} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/^Code/), {
      target: { value: "launch30" },
    });
    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: "Launch campaign" },
    });
    fireEvent.change(screen.getByLabelText(/^Duration \(months\)/), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Total use limit"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create promo code" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        code: "LAUNCH30",
        name: "Launch campaign",
        description: undefined,
        type: "campaign",
        plan_name: "pro",
        duration_months: 3,
        max_uses: 100,
        max_uses_per_org: 1,
        starts_at: undefined,
        expires_at: undefined,
      });
    });
  });

  it("blocks an expiration that is not after the start time", async () => {
    const onSubmit = vi.fn();
    render(<CreatePromoCodeForm saving={false} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/^Code/), {
      target: { value: "INVALID" },
    });
    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { value: "Invalid dates" },
    });
    fireEvent.change(screen.getByLabelText("Starts at"), {
      target: { value: "2026-08-02T10:00" },
    });
    fireEvent.change(screen.getByLabelText("Expires at"), {
      target: { value: "2026-08-01T10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create promo code" }));

    expect(
      await screen.findByText("Expiration must be after the start time."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disables submission while the request is saving", () => {
    render(<CreatePromoCodeForm saving onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Create promo code" }),
    ).toBeDisabled();
  });
});
