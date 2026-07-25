import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSsoAuthUrl,
  getPreferredSsoDomain,
  isLocalLoginRequested,
} from "./preferred-sso";

describe("getPreferredSsoDomain", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers NEXT_PUBLIC_PREFERRED_SSO_DOMAIN over host mapping", () => {
    vi.stubEnv("NEXT_PUBLIC_PREFERRED_SSO_DOMAIN", "example.com");
    expect(getPreferredSsoDomain("agents.l8ai.cn")).toBe("example.com");
  });

  it("maps oilan AgentCloud hosts to l8ai.cn", () => {
    vi.stubEnv("NEXT_PUBLIC_PREFERRED_SSO_DOMAIN", "");
    expect(getPreferredSsoDomain("agents.l8ai.cn")).toBe("l8ai.cn");
    expect(getPreferredSsoDomain("dowork.l8ai.cn")).toBe("l8ai.cn");
    expect(getPreferredSsoDomain("localhost")).toBeNull();
  });
});

describe("buildSsoAuthUrl", () => {
  it("builds the OIDC authorize entry with optional redirect", () => {
    expect(buildSsoAuthUrl("l8ai.cn", "oidc")).toContain(
      "/api/v1/auth/sso/l8ai.cn/oidc",
    );
    expect(buildSsoAuthUrl("l8ai.cn", "oidc", "/mesh")).toContain(
      "redirect=%2Fmesh",
    );
  });
});

describe("isLocalLoginRequested", () => {
  it("accepts local=1 or local=true", () => {
    expect(isLocalLoginRequested({ get: () => "1" })).toBe(true);
    expect(isLocalLoginRequested({ get: () => "true" })).toBe(true);
    expect(isLocalLoginRequested({ get: () => null })).toBe(false);
  });
});
