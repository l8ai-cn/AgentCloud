import type { MessageInitShape } from "@bufbuild/protobuf";
import {
  type AdminSSOConfig as ProtoSSOConfig,
  CreateSSOConfigRequestSchema,
  UpdateSSOConfigRequestSchema,
} from "@proto/sso/v1/sso_admin_pb";

import type {
  SSOConfig,
  SSOConfigInput,
  SSOProtocol,
  UpdateSSOConfigInput,
} from "./ssoTypes";

function protocolFromWire(value: string): SSOProtocol {
  if (value === "oidc" || value === "saml" || value === "ldap") return value;
  throw new Error(`Unsupported SSO protocol: ${value}`);
}

function organizationId(value: number | null | undefined, clearWithZero: boolean) {
  if (value === null) return clearWithZero ? BigInt(0) : undefined;
  return value === undefined ? undefined : BigInt(value);
}

export function ssoConfigFromProto(config: ProtoSSOConfig): SSOConfig {
  return {
    id: Number(config.id),
    domain: config.domain,
    name: config.name,
    protocol: protocolFromWire(config.protocol),
    is_enabled: config.isEnabled,
    enforce_sso: config.enforceSso,
    default_organization_id:
      config.defaultOrganizationId === undefined
        ? undefined
        : Number(config.defaultOrganizationId),
    oidc_issuer_url: config.oidcIssuerUrl,
    oidc_client_id: config.oidcClientId,
    oidc_scopes: config.oidcScopes,
    oidc_authorize_extra_params: config.oidcAuthorizeExtraParams,
    amp_bearer_app_codes: config.ampBearerAppCodes,
    saml_idp_metadata_url: config.samlIdpMetadataUrl,
    saml_idp_sso_url: config.samlIdpSsoUrl,
    saml_sp_entity_id: config.samlSpEntityId,
    saml_name_id_format: config.samlNameIdFormat,
    ldap_host: config.ldapHost,
    ldap_port: config.ldapPort,
    ldap_use_tls: config.ldapUseTls,
    ldap_bind_dn: config.ldapBindDn,
    ldap_base_dn: config.ldapBaseDn,
    ldap_user_filter: config.ldapUserFilter,
    ldap_email_attr: config.ldapEmailAttr,
    ldap_name_attr: config.ldapNameAttr,
    ldap_username_attr: config.ldapUsernameAttr,
    created_by: config.createdBy === undefined ? undefined : Number(config.createdBy),
    created_at: config.createdAt,
    updated_at: config.updatedAt,
  };
}

export function createSSOConfigMessage(
  input: SSOConfigInput,
): MessageInitShape<typeof CreateSSOConfigRequestSchema> {
  return {
    domain: input.domain,
    name: input.name,
    protocol: input.protocol,
    isEnabled: input.is_enabled,
    enforceSso: input.enforce_sso,
    defaultOrganizationId: organizationId(input.default_organization_id, false),
    oidcIssuerUrl: input.oidc_issuer_url,
    oidcClientId: input.oidc_client_id,
    oidcClientSecret: input.oidc_client_secret,
    oidcScopes: input.oidc_scopes,
    oidcAuthorizeExtraParams: input.oidc_authorize_extra_params,
    ampBearerAppCodes: input.amp_bearer_app_codes,
    samlIdpMetadataUrl: input.saml_idp_metadata_url,
    samlIdpMetadataXml: input.saml_idp_metadata_xml,
    samlIdpSsoUrl: input.saml_idp_sso_url,
    samlIdpCert: input.saml_idp_cert,
    samlSpEntityId: input.saml_sp_entity_id,
    samlNameIdFormat: input.saml_name_id_format,
    ldapHost: input.ldap_host,
    ldapPort: input.ldap_port,
    ldapUseTls: input.ldap_use_tls,
    ldapBindDn: input.ldap_bind_dn,
    ldapBindPassword: input.ldap_bind_password,
    ldapBaseDn: input.ldap_base_dn,
    ldapUserFilter: input.ldap_user_filter,
    ldapEmailAttr: input.ldap_email_attr,
    ldapNameAttr: input.ldap_name_attr,
    ldapUsernameAttr: input.ldap_username_attr,
  };
}

export function updateSSOConfigMessage(
  id: number,
  input: UpdateSSOConfigInput,
): MessageInitShape<typeof UpdateSSOConfigRequestSchema> {
  return {
    id: BigInt(id),
    name: input.name,
    isEnabled: input.is_enabled,
    enforceSso: input.enforce_sso,
    defaultOrganizationId: organizationId(input.default_organization_id, true),
    oidcIssuerUrl: input.oidc_issuer_url,
    oidcClientId: input.oidc_client_id,
    oidcClientSecret: input.oidc_client_secret,
    oidcScopes: input.oidc_scopes,
    oidcAuthorizeExtraParams: input.oidc_authorize_extra_params,
    ampBearerAppCodes: input.amp_bearer_app_codes,
    samlIdpMetadataUrl: input.saml_idp_metadata_url,
    samlIdpMetadataXml: input.saml_idp_metadata_xml,
    samlIdpSsoUrl: input.saml_idp_sso_url,
    samlIdpCert: input.saml_idp_cert,
    samlSpEntityId: input.saml_sp_entity_id,
    samlNameIdFormat: input.saml_name_id_format,
    ldapHost: input.ldap_host,
    ldapPort: input.ldap_port,
    ldapUseTls: input.ldap_use_tls,
    ldapBindDn: input.ldap_bind_dn,
    ldapBindPassword: input.ldap_bind_password,
    ldapBaseDn: input.ldap_base_dn,
    ldapUserFilter: input.ldap_user_filter,
    ldapEmailAttr: input.ldap_email_attr,
    ldapNameAttr: input.ldap_name_attr,
    ldapUsernameAttr: input.ldap_username_attr,
  };
}
