import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getAmpAccountUrl,
  hasFederatedIdentity,
  isSsoIdentity,
} from "./federated-identity";

describe("federated-identity", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("detects SSO provider prefixes", () => {
    expect(isSsoIdentity("sso_oidc_3")).toBe(true);
    expect(isSsoIdentity("sso_saml_1")).toBe(true);
    expect(isSsoIdentity("github")).toBe(false);
  });

  it("flags accounts with any federated identity", () => {
    expect(
      hasFederatedIdentity([
        {
          id: 1,
          user_id: 1,
          provider: "sso_oidc_2",
          provider_user_id: "principal:1",
          created_at: "",
          updated_at: "",
        },
      ]),
    ).toBe(true);
    expect(hasFederatedIdentity([])).toBe(false);
  });

  it("resolves AMP account URL from env with fallback", () => {
    expect(getAmpAccountUrl()).toBe("https://amp.l8ai.cn");
    vi.stubEnv("NEXT_PUBLIC_AMP_ACCOUNT_URL", "https://amp.example");
    expect(getAmpAccountUrl()).toBe("https://amp.example");
  });
});
