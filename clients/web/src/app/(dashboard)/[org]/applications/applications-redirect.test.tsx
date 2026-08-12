import { describe, expect, it, vi } from "vitest";

import ApplicationsRoute from "./page";
import ApplicationFirstRunRoute from "./[installationId]/page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/components/applications/ApplicationExpertRedirect", () => ({
  ApplicationExpertRedirect: ({
    orgSlug,
    installationID,
  }: {
    orgSlug: string;
    installationID: string;
  }) => ({ type: "application-expert-redirect", orgSlug, installationID }),
}));

import { redirect } from "next/navigation";

describe("organization application routes redirect into partners", () => {
  it("sends the applications index to the partner list", async () => {
    await ApplicationsRoute({ params: Promise.resolve({ org: "dev-org" }) });

    expect(redirect).toHaveBeenCalledWith("/dev-org/experts");
  });

  it("resolves an installation through the partner redirect", async () => {
    const result = await ApplicationFirstRunRoute({
      params: Promise.resolve({ org: "dev-org", installationId: "installation-1" }),
    });

    expect(result.props).toMatchObject({
      orgSlug: "dev-org",
      installationID: "installation-1",
    });
  });
});
