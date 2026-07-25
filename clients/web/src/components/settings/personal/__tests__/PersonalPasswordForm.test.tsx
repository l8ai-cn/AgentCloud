import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonalPasswordForm } from "../PersonalPasswordForm";

const changePassword = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/lib/api", () => ({
  userApi: {
    changePassword: (...args: unknown[]) => changePassword(...args),
  },
}));

vi.mock("@/lib/api/errors", () => ({
  getLocalizedErrorMessage: (_e: unknown, _t: unknown, fallback: string) => fallback,
}));

vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

describe("PersonalPasswordForm", () => {
  beforeEach(() => {
    changePassword.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("requires matching passwords of sufficient length", async () => {
    const user = userEvent.setup();
    render(<PersonalPasswordForm />);
    const submit = screen.getByRole("button", {
      name: "settings.personal.general.changePassword",
    });
    expect(submit).toBeDisabled();

    await user.type(
      screen.getByLabelText(/settings\.personal\.general\.currentPassword/),
      "oldpass12",
    );
    await user.type(
      screen.getByLabelText(/settings\.personal\.general\.newPassword/),
      "short",
    );
    expect(submit).toBeDisabled();
  });

  it("changes password when valid", async () => {
    changePassword.mockResolvedValue({ message: "ok" });
    const user = userEvent.setup();
    render(<PersonalPasswordForm />);

    await user.type(
      screen.getByLabelText(/settings\.personal\.general\.currentPassword/),
      "oldpass12",
    );
    await user.type(
      screen.getByLabelText(/settings\.personal\.general\.newPassword/),
      "newpass99",
    );
    await user.type(
      screen.getByLabelText(/settings\.personal\.general\.confirmPassword/),
      "newpass99",
    );
    await user.click(
      screen.getByRole("button", { name: "settings.personal.general.changePassword" }),
    );

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith("oldpass12", "newpass99");
    });
    expect(toastSuccess).toHaveBeenCalled();
  });
});
