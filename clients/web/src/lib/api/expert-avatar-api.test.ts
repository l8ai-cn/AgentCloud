import { describe, expect, it, vi } from "vitest";

const lightFetch = vi.fn();

vi.mock("@/lib/light-auth/api-fetch", () => ({
  lightFetch: (...args: unknown[]) => lightFetch(...args),
}));

import { loadExpertAvatarDataUrl } from "@/lib/api/expert-avatar-api";

describe("loadExpertAvatarDataUrl", () => {
  it("binds the avatar request to the route organization", async () => {
    const controller = new AbortController();
    lightFetch.mockResolvedValue({ content: "aW1hZ2U=" });

    const result = await loadExpertAvatarDataUrl(
      "acme",
      "delivery-partner",
      "assets/avatar.png",
      controller.signal,
    );

    expect(result).toBe("data:image/png;base64,aW1hZ2U=");
    expect(lightFetch).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/experts/delivery-partner/files/assets/avatar.png",
      { authenticated: true, signal: controller.signal },
    );
  });
});
