import type { SSOFormValues } from "./ssoFormTypes";

export type SSOValidationKey =
  | "sso.validation.domainAndNameRequired"
  | "sso.validation.invalidDomain"
  | "sso.validation.invalidOrganizationId"
  | "sso.validation.oidcRequired"
  | "sso.validation.invalidExtraParams"
  | "sso.validation.invalidAmpBearerCodes"
  | "sso.validation.samlSourceRequired"
  | "sso.validation.ldapRequired"
  | "sso.validation.invalidLdapPort";

function validJSON(value: string, expected: "array" | "object") {
  if (!value.trim()) return true;
  try {
    const parsed: unknown = JSON.parse(value);
    if (expected === "array") return Array.isArray(parsed);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

export function validateSSOForm(form: SSOFormValues, isEdit: boolean): SSOValidationKey | null {
  if (!form.domain.trim() || !form.name.trim()) return "sso.validation.domainAndNameRequired";
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(form.domain.trim())) {
    return "sso.validation.invalidDomain";
  }
  if (form.default_organization_id) {
    const id = Number(form.default_organization_id);
    if (!Number.isSafeInteger(id) || id <= 0) return "sso.validation.invalidOrganizationId";
  }
  if (form.protocol === "oidc") {
    if (!form.oidc_issuer_url.trim() || !form.oidc_client_id.trim()) {
      return "sso.validation.oidcRequired";
    }
    if (!validJSON(form.oidc_authorize_extra_params, "object")) {
      return "sso.validation.invalidExtraParams";
    }
    if (!validJSON(form.amp_bearer_app_codes, "array")) {
      return "sso.validation.invalidAmpBearerCodes";
    }
  }
  if (form.protocol === "saml" && !isEdit) {
    const hasMetadata = form.saml_idp_metadata_url.trim() || form.saml_idp_metadata_xml.trim();
    const hasManual = form.saml_idp_sso_url.trim() && form.saml_idp_cert.trim();
    if (!hasMetadata && !hasManual) {
      return "sso.validation.samlSourceRequired";
    }
  }
  if (form.protocol === "ldap") {
    if (!form.ldap_host.trim() || !form.ldap_base_dn.trim()) {
      return "sso.validation.ldapRequired";
    }
    const port = Number(form.ldap_port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return "sso.validation.invalidLdapPort";
    }
  }
  return null;
}
