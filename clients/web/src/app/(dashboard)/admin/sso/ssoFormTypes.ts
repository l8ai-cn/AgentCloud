import type {
  SSOConfig,
  SSOConfigInput,
  SSOProtocol,
  UpdateSSOConfigInput,
} from "@/lib/api/admin/sso";

export interface SSOFormValues {
  domain: string;
  name: string;
  protocol: SSOProtocol;
  is_enabled: boolean;
  enforce_sso: boolean;
  default_organization_id: string;
  oidc_issuer_url: string;
  oidc_client_id: string;
  oidc_client_secret: string;
  oidc_scopes: string;
  oidc_authorize_extra_params: string;
  amp_bearer_app_codes: string;
  saml_idp_metadata_url: string;
  saml_idp_metadata_xml: string;
  saml_idp_sso_url: string;
  saml_idp_cert: string;
  saml_sp_entity_id: string;
  saml_name_id_format: string;
  ldap_host: string;
  ldap_port: string;
  ldap_use_tls: boolean;
  ldap_bind_dn: string;
  ldap_bind_password: string;
  ldap_base_dn: string;
  ldap_user_filter: string;
  ldap_email_attr: string;
  ldap_name_attr: string;
  ldap_username_attr: string;
}

export type SSOFormUpdate = <K extends keyof SSOFormValues>(
  field: K,
  value: SSOFormValues[K],
) => void;

export const emptySSOForm: SSOFormValues = {
  domain: "",
  name: "",
  protocol: "oidc",
  is_enabled: true,
  enforce_sso: false,
  default_organization_id: "",
  oidc_issuer_url: "",
  oidc_client_id: "",
  oidc_client_secret: "",
  oidc_scopes: "openid profile email",
  oidc_authorize_extra_params: "",
  amp_bearer_app_codes: "",
  saml_idp_metadata_url: "",
  saml_idp_metadata_xml: "",
  saml_idp_sso_url: "",
  saml_idp_cert: "",
  saml_sp_entity_id: "",
  saml_name_id_format: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  ldap_host: "",
  ldap_port: "389",
  ldap_use_tls: false,
  ldap_bind_dn: "",
  ldap_bind_password: "",
  ldap_base_dn: "",
  ldap_user_filter: "(uid=%s)",
  ldap_email_attr: "mail",
  ldap_name_attr: "cn",
  ldap_username_attr: "uid",
};

export function formFromSSOConfig(config: SSOConfig): SSOFormValues {
  return {
    ...emptySSOForm,
    domain: config.domain,
    name: config.name,
    protocol: config.protocol,
    is_enabled: config.is_enabled,
    enforce_sso: config.enforce_sso,
    default_organization_id: config.default_organization_id?.toString() ?? "",
    oidc_issuer_url: config.oidc_issuer_url ?? "",
    oidc_client_id: config.oidc_client_id ?? "",
    oidc_scopes: config.oidc_scopes ?? "openid profile email",
    oidc_authorize_extra_params: config.oidc_authorize_extra_params ?? "",
    amp_bearer_app_codes: config.amp_bearer_app_codes ?? "",
    saml_idp_metadata_url: config.saml_idp_metadata_url ?? "",
    saml_idp_sso_url: config.saml_idp_sso_url ?? "",
    saml_sp_entity_id: config.saml_sp_entity_id ?? "",
    saml_name_id_format: config.saml_name_id_format ?? "",
    ldap_host: config.ldap_host ?? "",
    ldap_port: config.ldap_port?.toString() ?? "389",
    ldap_use_tls: config.ldap_use_tls ?? false,
    ldap_bind_dn: config.ldap_bind_dn ?? "",
    ldap_base_dn: config.ldap_base_dn ?? "",
    ldap_user_filter: config.ldap_user_filter ?? "(uid=%s)",
    ldap_email_attr: config.ldap_email_attr ?? "mail",
    ldap_name_attr: config.ldap_name_attr ?? "cn",
    ldap_username_attr: config.ldap_username_attr ?? "uid",
  };
}

function optional(value: string) {
  return value.trim() || undefined;
}

function organizationId(value: string): number | undefined {
  return value ? Number(value) : undefined;
}

function protocolFields(form: SSOFormValues) {
  if (form.protocol === "oidc") {
    return {
      oidc_issuer_url: form.oidc_issuer_url.trim(),
      oidc_client_id: form.oidc_client_id.trim(),
      oidc_client_secret: optional(form.oidc_client_secret),
      oidc_scopes: form.oidc_scopes.trim(),
      oidc_authorize_extra_params: form.oidc_authorize_extra_params.trim(),
      amp_bearer_app_codes: form.amp_bearer_app_codes.trim(),
    };
  }
  if (form.protocol === "saml") {
    return {
      saml_idp_metadata_url: form.saml_idp_metadata_url.trim(),
      saml_idp_metadata_xml: optional(form.saml_idp_metadata_xml),
      saml_idp_sso_url: form.saml_idp_sso_url.trim(),
      saml_idp_cert: optional(form.saml_idp_cert),
      saml_sp_entity_id: form.saml_sp_entity_id.trim(),
      saml_name_id_format: form.saml_name_id_format.trim(),
    };
  }
  return {
    ldap_host: form.ldap_host.trim(),
    ldap_port: Number(form.ldap_port),
    ldap_use_tls: form.ldap_use_tls,
    ldap_bind_dn: form.ldap_bind_dn.trim(),
    ldap_bind_password: optional(form.ldap_bind_password),
    ldap_base_dn: form.ldap_base_dn.trim(),
    ldap_user_filter: form.ldap_user_filter.trim(),
    ldap_email_attr: form.ldap_email_attr.trim(),
    ldap_name_attr: form.ldap_name_attr.trim(),
    ldap_username_attr: form.ldap_username_attr.trim(),
  };
}

export function createInputFromForm(form: SSOFormValues): SSOConfigInput {
  return {
    domain: form.domain.trim().toLowerCase(),
    name: form.name.trim(),
    protocol: form.protocol,
    is_enabled: form.is_enabled,
    enforce_sso: form.enforce_sso,
    default_organization_id: organizationId(form.default_organization_id),
    ...protocolFields(form),
  };
}

export function updateInputFromForm(form: SSOFormValues): UpdateSSOConfigInput {
  return {
    name: form.name.trim(),
    is_enabled: form.is_enabled,
    enforce_sso: form.enforce_sso,
    default_organization_id: form.default_organization_id
      ? Number(form.default_organization_id)
      : null,
    ...protocolFields(form),
  };
}
