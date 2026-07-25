import { getAuthManager } from "@/lib/wasm-core";
import { readCurrentOrg } from "@/stores/auth";

export function requireCurrentOrganizationSlug(): string {
  const slug = readCurrentOrg()?.slug;
  if (!slug) throw new Error("Not authenticated");
  return slug;
}

export async function authenticatedOrganizationFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const token = getAuthManager().get_token();
  if (!token) throw new Error("Not authenticated");
  const headers = {
    ...(init?.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${token}`,
  };
  return fetch(url, { ...init, headers });
}
