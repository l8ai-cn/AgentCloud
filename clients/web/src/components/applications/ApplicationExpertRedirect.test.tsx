import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@/test/test-utils";

import { ApplicationExpertRedirect } from "./ApplicationExpertRedirect";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/stores/auth", () => ({
  useCurrentOrg: () => ({ id: 9, slug: "dev-org", name: "Dev" }),
}));

vi.mock("@/lib/marketplace/expert-slug-from-installation", () => ({
  resolveExpertSlugFromInstallation: vi.fn(),
}));

import { resolveExpertSlugFromInstallation } from "@/lib/marketplace/expert-slug-from-installation";

describe("ApplicationExpertRedirect", () => {
  beforeEach(() => {
    replace.mockReset();
  });

  it("opens the mapped partner when the installation resolves", async () => {
    vi.mocked(resolveExpertSlugFromInstallation).mockResolvedValue("delivery-agent");

    render(<ApplicationExpertRedirect orgSlug="dev-org" installationID="installation-1" />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/dev-org/experts/delivery-agent");
    });
  });

  it("falls back to the partner list when the installation cannot be mapped", async () => {
    vi.mocked(resolveExpertSlugFromInstallation).mockResolvedValue(undefined);

    render(<ApplicationExpertRedirect orgSlug="dev-org" installationID="missing" />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/dev-org/experts");
    });
  });
});
