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
  function redirectParam(url: string): string | null {
    return new URL(url).searchParams.get("redirect");
  }

  it("builds the OIDC authorize entry without a redirect", () => {
    const url = buildSsoAuthUrl("l8ai.cn", "oidc");
    expect(url).toContain("/api/v1/auth/sso/l8ai.cn/oidc");
    expect(redirectParam(url)).toBeNull();
  });

  it("routes the destination through the callback page that consumes tokens", () => {
    const target = redirectParam(buildSsoAuthUrl("l8ai.cn", "oidc", "/mesh"));
    expect(new URL(target!).pathname).toBe("/auth/sso/callback");
    expect(new URL(target!).searchParams.get("redirect")).toBe("/mesh");
  });

  it("keeps a deep link's own query string intact", () => {
    const deepLink = "/l8ai/workspace?pod=2-standalone-667cc713";
    const target = redirectParam(buildSsoAuthUrl("l8ai.cn", "oidc", deepLink));
    expect(new URL(target!).searchParams.get("redirect")).toBe(deepLink);
  });

  it("drops a redirect that leaves the app", () => {
    expect(redirectParam(buildSsoAuthUrl("l8ai.cn", "oidc", "//evil.example"))).toBeNull();
    expect(redirectParam(buildSsoAuthUrl("l8ai.cn", "oidc", "https://evil.example"))).toBeNull();
  });
});

describe("isLocalLoginRequested", () => {
  it("accepts local=1 or local=true", () => {
    expect(isLocalLoginRequested({ get: () => "1" })).toBe(true);
    expect(isLocalLoginRequested({ get: () => "true" })).toBe(true);
    expect(isLocalLoginRequested({ get: () => null })).toBe(false);
  });
});
