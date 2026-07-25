import type { Identity } from "@/lib/api/connect/userConnect";

export function isSsoIdentity(provider: string): boolean {
  return provider.startsWith("sso_oidc_") ||
    provider.startsWith("sso_saml_") ||
    provider.startsWith("sso_ldap_");
}

export function hasFederatedIdentity(identities: Identity[]): boolean {
  return identities.some((item) => isSsoIdentity(item.provider));
}

export function getAmpAccountUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_AMP_ACCOUNT_URL?.trim();
  if (fromEnv && !fromEnv.startsWith("__")) return fromEnv;
  return "https://amp.l8ai.cn";
}
