import { render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveIsSystemAdmin = vi.fn();
const replace = vi.fn();
let currentOrg: { slug: string } | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/hooks/useIsSystemAdmin", () => ({
  resolveIsSystemAdmin: () => resolveIsSystemAdmin(),
}));

vi.mock("@/stores/auth", () => ({
  readCurrentOrg: () => currentOrg,
  useAuthStore: (selector: (state: { _tick: number }) => number) =>
    selector({ _tick: 0 }),
}));

import { AdminGuard } from "./AdminGuard";

function renderGuard() {
  return render(
    <AdminGuard>
      <p>admin console</p>
    </AdminGuard>,
  );
}

describe("AdminGuard", () => {
  beforeEach(() => {
    resolveIsSystemAdmin.mockReset();
    replace.mockReset();
    currentOrg = { slug: "acme" };
  });

  it("shows a spinner while the admin flag is still resolving", () => {
    resolveIsSystemAdmin.mockReturnValue(new Promise<boolean>(() => {}));

    const { container } = renderGuard();

    expect(container.querySelector(".animate-spin")).not.toBeNull();
    expect(screen.queryByText("admin console")).not.toBeInTheDocument();
  });

  it("renders children once the user is confirmed as a system admin", async () => {
    resolveIsSystemAdmin.mockResolvedValue(true);

    renderGuard();

    expect(await screen.findByText("admin console")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects a non-admin to their current organization and renders nothing", async () => {
    resolveIsSystemAdmin.mockResolvedValue(false);

    const { container } = renderGuard();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/acme");
    });
    expect(screen.queryByText("admin console")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("redirects a non-admin without a current organization to the root", async () => {
    currentOrg = null;
    resolveIsSystemAdmin.mockResolvedValue(false);

    renderGuard();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/");
    });
  });
});
