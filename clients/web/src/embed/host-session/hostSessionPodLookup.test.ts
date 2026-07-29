import { describe, expect, it, vi } from "vitest";

import { resolveHostSessionId } from "@/embed/host-session/hostSessionPodLookup";

const identity = { accessToken: "amp-token", orgSlug: "acme", podKey: "worker/1" };

describe("host session pod lookup", () => {
  it("resolves the session id with the host bearer and org header", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "conv_live" }), { status: 200 }));

    await expect(resolveHostSessionId(identity, fetcher)).resolves.toBe("conv_live");
    expect(fetcher).toHaveBeenCalledWith("/v1/sessions/by-pod/worker%2F1", {
      headers: {
        Authorization: "Bearer amp-token",
        "X-Organization-Slug": "acme",
      },
      cache: "no-store",
    });
  });

  it("surfaces an error when the pod has no visible session", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await expect(resolveHostSessionId(identity, fetcher)).rejects.toThrow(
      "host_session_pod_has_no_session",
    );
  });

  it("surfaces an error when the lookup is rejected", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));

    await expect(resolveHostSessionId(identity, fetcher)).rejects.toThrow(
      "host_session_pod_lookup_failed:403",
    );
  });

  it("surfaces an error when the lookup response carries no session id", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "" }), { status: 200 }));

    await expect(resolveHostSessionId(identity, fetcher)).rejects.toThrow(
      "host_session_pod_lookup_invalid",
    );
  });
});
