import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileMoreMenu } from "../MobileMoreMenu";

const push = vi.fn();
const setMobileMoreMenuOpen = vi.fn();
let isSystemAdmin = false;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    key === "admin.title" ? "System administration" : key,
}));

vi.mock("@/hooks/useIsSystemAdmin", () => ({
  useIsSystemAdmin: () => isSystemAdmin,
}));

vi.mock("@/stores/auth", () => ({
  useCurrentOrg: () => ({ slug: "dev-org" }),
}));

vi.mock("@/stores/ide", () => ({
  useIDEStore: () => ({
    setActiveActivity: vi.fn(),
    mobileMoreMenuOpen: true,
    setMobileMoreMenuOpen,
  }),
  getMoreMenuActivities: () => [{ id: "mesh", icon: "network" }],
}));

vi.mock("../MobileThemeMenu", () => ({
  MobileThemeMenu: () => <div data-testid="theme-menu" />,
}));

vi.mock("vaul", () => ({
  Drawer: {
    Root: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
      open ? <div>{children}</div> : null,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Overlay: () => <div />,
    Content: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Title: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}));

describe("MobileMoreMenu", () => {
  beforeEach(() => {
    push.mockClear();
    setMobileMoreMenuOpen.mockClear();
    isSystemAdmin = false;
  });

  it("hides system administration from non-admins", () => {
    render(<MobileMoreMenu />);

    expect(screen.queryByText("System administration")).not.toBeInTheDocument();
  });

  it("navigates system admins to the admin console and closes the sheet", () => {
    isSystemAdmin = true;
    render(<MobileMoreMenu />);

    fireEvent.click(screen.getByText("System administration"));

    expect(push).toHaveBeenCalledWith("/admin");
    expect(setMobileMoreMenuOpen).toHaveBeenCalledWith(false);
  });
});
