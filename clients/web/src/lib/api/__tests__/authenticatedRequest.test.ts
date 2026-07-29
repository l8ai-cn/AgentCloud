import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api-types";

const mocks = vi.hoisted(() => ({
  token: "test-token" as string | null,
  orgSlug: "test-org" as string | null,
  logout: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/wasm-core", () => ({
  getAuthManager: () => ({ get_token: () => mocks.token }),
}));
vi.mock("@/stores/auth", () => ({
  readCurrentOrg: () =>
    mocks.orgSlug ? { slug: mocks.orgSlug } : null,
  useAuthStore: {
    getState: () => ({ logout: mocks.logout }),
  },
}));

import {
  authenticatedFetch,
  authenticatedOrganizationFetch,
} from "../authenticatedRequest";

describe("authenticatedRequest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.token = "test-token";
    mocks.orgSlug = "test-org";
    mocks.logout.mockClear();
  });

  it("injects authoritative auth and organization headers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );

    await authenticatedOrganizationFetch("/v1/test", {
      headers: {
        Authorization: "Bearer caller-token",
        "X-Organization-Slug": "caller-org",
        "Idempotency-Key": "op-1",
      },
    });

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-token");
    expect(headers.get("X-Organization-Slug")).toBe("test-org");
    expect(headers.get("Idempotency-Key")).toBe("op-1");
  });

  it("fails before fetch when authentication is missing", async () => {
    mocks.token = null;
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(authenticatedFetch("/v1/test")).rejects.toMatchObject({
      status: 401,
      code: "AUTH_REQUIRED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails before fetch when the current organization is missing", async () => {
    mocks.orgSlug = null;
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(
      authenticatedOrganizationFetch("/v1/test"),
    ).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes nested error bodies and invalidates a 401 session", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "TOKEN_REVOKED", message: "Token revoked" },
        }),
        { status: 401, statusText: "Unauthorized" },
      ),
    );

    const error = await authenticatedFetch("/v1/test").catch((value) => value);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 401,
      code: "TOKEN_REVOKED",
      serverMessage: "Token revoked",
    });
    expect(mocks.logout).toHaveBeenCalledTimes(1);
  });

  it("does not set a multipart content type for FormData", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    const body = new FormData();
    body.set("file", new Blob(["data"]), "test.txt");

    await authenticatedFetch("/v1/upload", { method: "POST", body });

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.has("Content-Type")).toBe(false);
    expect(fetchMock.mock.calls[0][1]?.body).toBe(body);
  });
});
