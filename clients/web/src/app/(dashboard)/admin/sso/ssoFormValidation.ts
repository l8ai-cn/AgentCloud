import type { SSOFormValues } from "./ssoFormTypes";

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

export function validateSSOForm(form: SSOFormValues, isEdit: boolean): string | null {
  if (!form.domain.trim() || !form.name.trim()) return "Domain and display name are required.";
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(form.domain.trim())) {
    return "Enter a valid domain such as example.com.";
  }
  if (form.default_organization_id) {
    const id = Number(form.default_organization_id);
    if (!Number.isSafeInteger(id) || id <= 0) return "Default organization ID must be a positive integer.";
  }
  if (form.protocol === "oidc") {
    if (!form.oidc_issuer_url.trim() || !form.oidc_client_id.trim()) {
      return "OIDC issuer URL and client ID are required.";
    }
    if (!validJSON(form.oidc_authorize_extra_params, "object")) {
      return "Authorize extra parameters must be a JSON object.";
    }
    if (!validJSON(form.amp_bearer_app_codes, "array")) {
      return "AMP bearer application codes must be a JSON array.";
    }
  }
  if (form.protocol === "saml" && !isEdit) {
    const hasMetadata = form.saml_idp_metadata_url.trim() || form.saml_idp_metadata_xml.trim();
    const hasManual = form.saml_idp_sso_url.trim() && form.saml_idp_cert.trim();
    if (!hasMetadata && !hasManual) {
      return "Provide metadata URL, metadata XML, or an SSO URL with certificate.";
    }
  }
  if (form.protocol === "ldap") {
    if (!form.ldap_host.trim() || !form.ldap_base_dn.trim()) {
      return "LDAP host and base DN are required.";
    }
    const port = Number(form.ldap_port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return "LDAP port must be between 1 and 65535.";
    }
  }
  return null;
}
