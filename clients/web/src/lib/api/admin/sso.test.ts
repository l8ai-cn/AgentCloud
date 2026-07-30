import { beforeEach, describe, expect, it, vi } from "vitest";

const callAdminConnect = vi.fn();

vi.mock("./transport", () => ({
  callAdminConnect: (...args: unknown[]) => callAdminConnect(...args),
}));

import {
  createSSOConfig,
  deleteSSOConfig,
  disableSSOConfig,
  enableSSOConfig,
  listSSOConfigs,
  testSSOConnection,
  updateSSOConfig,
} from "./sso";

function protoConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: 7n,
    domain: "example.com",
    name: "Example",
    protocol: "oidc",
    isEnabled: true,
    enforceSso: false,
    defaultOrganizationId: 9n,
    oidcIssuerUrl: "https://id.example.com",
    oidcClientId: "client-id",
    oidcScopes: "openid profile email",
    oidcAuthorizeExtraParams: '{"tenant":"example"}',
    ampBearerAppCodes: '["ZHIYONG"]',
    samlIdpMetadataUrl: undefined,
    samlIdpSsoUrl: undefined,
    samlSpEntityId: undefined,
    samlNameIdFormat: undefined,
    ldapHost: undefined,
    ldapPort: undefined,
    ldapUseTls: undefined,
    ldapBindDn: undefined,
    ldapBaseDn: undefined,
    ldapUserFilter: undefined,
    ldapEmailAttr: undefined,
    ldapNameAttr: undefined,
    ldapUsernameAttr: undefined,
    createdBy: 3n,
    createdAt: "2026-07-30T00:00:00Z",
    updatedAt: "2026-07-30T01:00:00Z",
    ...overrides,
  };
}

describe("admin SSO API", () => {
  beforeEach(() => callAdminConnect.mockReset());

  it("maps search filters and server pagination", async () => {
    callAdminConnect.mockResolvedValue({
      data: [protoConfig()],
      total: 41n,
      page: 2,
      pageSize: 20,
      totalPages: 3n,
    });

    const result = await listSSOConfigs({
      search: "example",
      protocol: "oidc",
      page: 2,
      page_size: 20,
    });

    expect(callAdminConnect).toHaveBeenCalledWith(
      "proto.sso.v1.SSOAdminService",
      "ListSSOConfigs",
      expect.anything(),
      expect.anything(),
      { search: "example", protocol: "oidc", page: 2, pageSize: 20 },
    );
    expect(result).toMatchObject({
      total: 41,
      page: 2,
      page_size: 20,
      total_pages: 3,
      data: [{
        id: 7,
        protocol: "oidc",
        default_organization_id: 9,
        amp_bearer_app_codes: '["ZHIYONG"]',
        created_by: 3,
      }],
    });
  });

  it("sends create fields using the generated contract", async () => {
    callAdminConnect.mockResolvedValue(protoConfig());

    await createSSOConfig({
      domain: "example.com",
      name: "Example",
      protocol: "oidc",
      is_enabled: true,
      enforce_sso: true,
      default_organization_id: 9,
      oidc_issuer_url: "https://id.example.com",
      oidc_client_id: "client-id",
      oidc_client_secret: "secret",
      amp_bearer_app_codes: '["ZHIYONG"]',
    });

    expect(callAdminConnect).toHaveBeenCalledWith(
      "proto.sso.v1.SSOAdminService",
      "CreateSSOConfig",
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        domain: "example.com",
        isEnabled: true,
        enforceSso: true,
        defaultOrganizationId: 9n,
        oidcClientSecret: "secret",
        ampBearerAppCodes: '["ZHIYONG"]',
      }),
    );
  });

  it("uses proto presence for updates and zero to clear the default organization", async () => {
    callAdminConnect.mockResolvedValue(protoConfig({ defaultOrganizationId: undefined }));

    await updateSSOConfig(7, {
      name: "Renamed",
      default_organization_id: null,
      oidc_client_secret: undefined,
      oidc_authorize_extra_params: "",
    });

    expect(callAdminConnect).toHaveBeenCalledWith(
      "proto.sso.v1.SSOAdminService",
      "UpdateSSOConfig",
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        id: 7n,
        name: "Renamed",
        defaultOrganizationId: 0n,
        oidcClientSecret: undefined,
        oidcAuthorizeExtraParams: "",
      }),
    );
  });

  it("calls action RPCs with bigint IDs", async () => {
    callAdminConnect
      .mockResolvedValueOnce(protoConfig({ isEnabled: true }))
      .mockResolvedValueOnce(protoConfig({ isEnabled: false }))
      .mockResolvedValueOnce({ success: false, error: "TLS handshake failed" })
      .mockResolvedValueOnce({});

    await enableSSOConfig(7);
    await disableSSOConfig(7);
    await expect(testSSOConnection(7)).resolves.toEqual({
      success: false,
      message: undefined,
      error: "TLS handshake failed",
    });
    await deleteSSOConfig(7);

    expect(callAdminConnect.mock.calls.map((call) => call[1])).toEqual([
      "EnableSSOConfig",
      "DisableSSOConfig",
      "TestSSOConnection",
      "DeleteSSOConfig",
    ]);
    for (const call of callAdminConnect.mock.calls) {
      expect(call[4]).toEqual({ id: 7n });
    }
  });

  it("rejects unknown protocol values instead of casting them", async () => {
    callAdminConnect.mockResolvedValue({
      data: [protoConfig({ protocol: "oauth2" })],
      total: 1n,
      page: 1,
      pageSize: 20,
      totalPages: 1n,
    });

    await expect(listSSOConfigs()).rejects.toThrow("Unsupported SSO protocol: oauth2");
  });
});
