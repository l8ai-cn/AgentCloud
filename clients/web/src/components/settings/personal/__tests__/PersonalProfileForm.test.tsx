import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonalProfileForm } from "../PersonalProfileForm";

const updateMe = vi.fn();
const syncCurrentUser = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/lib/api", () => ({
  userApi: {
    updateMe: async (...args: unknown[]) => ({ user: await updateMe(...args) }),
  },
}));

vi.mock("@/lib/api/errors", () => ({
  getLocalizedErrorMessage: (_e: unknown, _t: unknown, fallback: string) => fallback,
}));

vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/stores/auth", () => ({
  useCurrentUser: () => ({
    id: 1,
    email: "dev@test.com",
    username: "devuser",
    name: "Dev",
    avatar_url: "https://example.com/a.png",
  }),
  useAuthStore: (sel: (s: { syncCurrentUser: typeof syncCurrentUser }) => unknown) =>
    sel({ syncCurrentUser }),
}));

describe("PersonalProfileForm", () => {
  beforeEach(() => {
    updateMe.mockReset();
    syncCurrentUser.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("saves display name and avatar url", async () => {
    updateMe.mockResolvedValue({
      id: 1,
      email: "dev@test.com",
      username: "devuser",
      name: "Ada",
      avatar_url: "https://example.com/b.png",
      is_active: true,
      is_system_admin: false,
      is_email_verified: true,
      created_at: "",
      updated_at: "",
    });
    const user = userEvent.setup();
    render(<PersonalProfileForm />);

    const name = screen.getByLabelText("settings.personal.general.displayName");
    const avatar = screen.getByLabelText("settings.personal.general.avatarUrl");
    await user.clear(name);
    await user.type(name, "Ada");
    await user.clear(avatar);
    await user.type(avatar, "https://example.com/b.png");
    await user.click(screen.getByRole("button", { name: "settings.personal.general.saveProfile" }));

    await waitFor(() => {
      expect(updateMe).toHaveBeenCalledWith({
        name: "Ada",
        avatar_url: "https://example.com/b.png",
      });
    });
    expect(syncCurrentUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Ada", avatar_url: "https://example.com/b.png" }),
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("disables save when nothing changed", () => {
    render(<PersonalProfileForm />);
    expect(
      screen.getByRole("button", { name: "settings.personal.general.saveProfile" }),
    ).toBeDisabled();
  });
});
