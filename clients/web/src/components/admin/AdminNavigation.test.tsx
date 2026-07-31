import { render, screen } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/admin";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

import { AdminNavigation } from "./AdminNavigation";

const entries = [
  ["Overview", "/admin"],
  ["Users", "/admin/users"],
  ["Organizations", "/admin/organizations"],
  ["Runners", "/admin/runners"],
  ["Relays", "/admin/relays"],
  ["SSO", "/admin/sso"],
  ["Promo codes", "/admin/promo-codes"],
  ["Support", "/admin/support-tickets"],
  ["Expert review", "/admin/expert-market"],
  ["Audit logs", "/admin/audit-logs"],
] as const;

function link(name: string) {
  return screen.getByRole("link", { name });
}

describe("AdminNavigation", () => {
  beforeEach(() => {
    pathname = "/admin";
  });

  it("labels the navigation landmark for screen readers", () => {
    render(<AdminNavigation />);

    expect(
      screen.getByRole("navigation", { name: "System administration" }),
    ).toBeInTheDocument();
  });

  it("renders every admin section with its own href", () => {
    render(<AdminNavigation />);

    for (const [name, href] of entries) {
      expect(link(name)).toHaveAttribute("href", href);
    }
    expect(screen.getAllByRole("link")).toHaveLength(entries.length);
  });

  it("marks overview active only on an exact /admin match", () => {
    render(<AdminNavigation />);

    expect(link("Overview")).toHaveAttribute("aria-current", "page");
    for (const [name] of entries.slice(1)) {
      expect(link(name)).not.toHaveAttribute("aria-current");
    }
  });

  it("moves the active marker to the section matching the pathname", () => {
    pathname = "/admin/support-tickets";
    render(<AdminNavigation />);

    expect(link("Support")).toHaveAttribute("aria-current", "page");
    expect(link("Overview")).not.toHaveAttribute("aria-current");
  });

  it("keeps the section active on nested detail routes", () => {
    pathname = "/admin/promo-codes/42";
    render(<AdminNavigation />);

    expect(link("Promo codes")).toHaveAttribute("aria-current", "page");
    expect(
      screen.getAllByRole("link").filter((el) => el.getAttribute("aria-current")),
    ).toHaveLength(1);
  });
});
