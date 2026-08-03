import { safeRedirectPath } from "@/lib/auth/redirect";
import { getOAuthBaseUrl } from "@/lib/env";

const SSO_CALLBACK_PATH = "/auth/sso/callback";

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

// The backend appends the token pair to whatever `redirect` resolves to, and
// only the callback page consumes it. Handing SSO a deep link therefore lands
// an unauthenticated app on the destination, which bounces back into SSO.
function ssoCallbackRedirect(destination: string): string {
  const callback = `${SSO_CALLBACK_PATH}?redirect=${encodeURIComponent(destination)}`;
  if (typeof window === "undefined") return callback;
  return new URL(callback, window.location.origin).toString();
}

export function buildSsoAuthUrl(domain: string, protocol = "oidc", redirect?: string | null): string {
  const base = getOAuthBaseUrl();
  const params = new URLSearchParams();
  const destination = safeRedirectPath(redirect ?? null);
  if (destination) params.set("redirect", ssoCallbackRedirect(destination));
  const query = params.toString();
  return `${base}/api/v1/auth/sso/${encodeURIComponent(domain)}/${encodeURIComponent(protocol)}${
    query ? `?${query}` : ""
  }`;
}

export function isLocalLoginRequested(searchParams: { get(name: string): string | null }): boolean {
  const value = searchParams.get("local");
  return value === "1" || value === "true";
}
