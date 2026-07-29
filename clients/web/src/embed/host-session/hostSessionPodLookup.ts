import { hostFetch } from "@/embed/hostFetch";

import type { HostSessionIdentity } from "./hostSessionCredentialStore";

type HostSessionFetch = (path: string, init?: RequestInit) => Promise<Response>;

export async function resolveHostSessionId(
  input: HostSessionIdentity & { accessToken: string },
  fetcher: HostSessionFetch = hostFetch,
): Promise<string> {
  const response = await fetcher(
    `/v1/sessions/by-pod/${encodeURIComponent(input.podKey)}`,
    {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "X-Organization-Slug": input.orgSlug,
      },
      cache: "no-store",
    },
  );
  if (response.status === 204) {
    throw new Error("host_session_pod_has_no_session");
  }
  if (!response.ok) {
    throw new Error(`host_session_pod_lookup_failed:${response.status}`);
  }
  const body = (await response.json()) as { id?: unknown };
  if (typeof body.id !== "string" || body.id === "") {
    throw new Error("host_session_pod_lookup_invalid");
  }
  return body.id;
}
