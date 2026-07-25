import { getOAuthBaseUrl } from "@/lib/env";

// Host → email-domain used for AgentCloud's first AMP customer cutover.
// Env wins when the image was built with NEXT_PUBLIC_PREFERRED_SSO_DOMAIN.
const HOST_PREFERRED_SSO_DOMAIN: Record<string, string> = {
  "agents.l8ai.cn": "l8ai.cn",
  "dowork.l8ai.cn": "l8ai.cn",
};

export function getPreferredSsoDomain(hostname?: string): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_PREFERRED_SSO_DOMAIN?.trim();
  if (fromEnv && !fromEnv.startsWith("__")) {
    return fromEnv.toLowerCase();
  }
  const host = (hostname ?? (typeof window !== "undefined" ? window.location.hostname : ""))
    .trim()
    .toLowerCase();
  if (!host) return null;
  return HOST_PREFERRED_SSO_DOMAIN[host] ?? null;
}

export function buildSsoAuthUrl(domain: string, protocol = "oidc", redirect?: string | null): string {
  const base = getOAuthBaseUrl();
  const params = new URLSearchParams();
  if (redirect) params.set("redirect", redirect);
  const query = params.toString();
  return `${base}/api/v1/auth/sso/${encodeURIComponent(domain)}/${encodeURIComponent(protocol)}${
    query ? `?${query}` : ""
  }`;
}

export function isLocalLoginRequested(searchParams: { get(name: string): string | null }): boolean {
  const value = searchParams.get("local");
  return value === "1" || value === "true";
}
