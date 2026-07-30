export type SSOProtocol = "oidc" | "saml" | "ldap";

export interface SSOConfig {
  id: number;
  domain: string;
  name: string;
  protocol: SSOProtocol;
  is_enabled: boolean;
  enforce_sso: boolean;
  default_organization_id?: number;
  oidc_issuer_url?: string;
  oidc_client_id?: string;
  oidc_scopes?: string;
  oidc_authorize_extra_params?: string;
  amp_bearer_app_codes?: string;
  saml_idp_metadata_url?: string;
  saml_idp_sso_url?: string;
  saml_sp_entity_id?: string;
  saml_name_id_format?: string;
  ldap_host?: string;
  ldap_port?: number;
  ldap_use_tls?: boolean;
  ldap_bind_dn?: string;
  ldap_base_dn?: string;
  ldap_user_filter?: string;
  ldap_email_attr?: string;
  ldap_name_attr?: string;
  ldap_username_attr?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export interface SSOConfigInput {
  domain: string;
  name: string;
  protocol: SSOProtocol;
  is_enabled: boolean;
  enforce_sso: boolean;
  default_organization_id?: number | null;
  oidc_issuer_url?: string;
  oidc_client_id?: string;
  oidc_client_secret?: string;
  oidc_scopes?: string;
  oidc_authorize_extra_params?: string;
  amp_bearer_app_codes?: string;
  saml_idp_metadata_url?: string;
  saml_idp_metadata_xml?: string;
  saml_idp_sso_url?: string;
  saml_idp_cert?: string;
  saml_sp_entity_id?: string;
  saml_name_id_format?: string;
  ldap_host?: string;
  ldap_port?: number;
  ldap_use_tls?: boolean;
  ldap_bind_dn?: string;
  ldap_bind_password?: string;
  ldap_base_dn?: string;
  ldap_user_filter?: string;
  ldap_email_attr?: string;
  ldap_name_attr?: string;
  ldap_username_attr?: string;
}

export type UpdateSSOConfigInput = Omit<
  Partial<SSOConfigInput>,
  "domain" | "protocol"
>;

export interface SSOConfigListParams {
  search?: string;
  protocol?: SSOProtocol;
  page?: number;
  page_size?: number;
}

export interface SSOTestResult {
  success: boolean;
  message?: string;
  error?: string;
}
