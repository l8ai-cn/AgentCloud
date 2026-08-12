import { beforeEach, describe, expect, it, vi } from "vitest";

import { sessionStorageKey } from "@/lib/light-session";
import {
  resolveExpertSlugFromInstallation,
  resolveExpertSlugFromRuntimeRef,
} from "./expert-slug-from-installation";

describe("expert slug from installation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem(
      sessionStorageKey(window.location.origin),
      JSON.stringify({
        access_token: "market-token",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    );
  });

  it("maps an installation runtime ref onto the matching partner slug", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/organizations/9/applications")) {
        return new Response(JSON.stringify({
          applications: [{
            installation_id: "installation-1",
            runtime_ref: "expert:12",
          }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/api/v1/orgs/dev-org/experts")) {
        return new Response(JSON.stringify({
          experts: [{ id: 12, slug: "delivery-agent" }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("not found", { status: 404 });
    });

    await expect(resolveExpertSlugFromInstallation("dev-org", 9, "installation-1"))
      .resolves.toBe("delivery-agent");
  });

  it("returns undefined when the runtime ref does not point at an expert", async () => {
    await expect(resolveExpertSlugFromRuntimeRef("dev-org", "connector:1"))
      .resolves.toBeUndefined();
  });
});
