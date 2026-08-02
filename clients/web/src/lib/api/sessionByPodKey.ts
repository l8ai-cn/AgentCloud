import { getApiBaseUrl } from "@/lib/env";
import { authenticatedOrganizationFetch } from "./authenticatedRequest";

export async function fetchSessionByPodKey(
  podKey: string,
): Promise<{ id: string; title: string | null } | null> {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const res = await authenticatedOrganizationFetch(
    `${base}/v1/sessions/by-pod/${encodeURIComponent(podKey)}`,
  );
  if (res.status === 204) return null;
  const wire = (await res.json()) as { id: string; title?: string | null };
  return { id: wire.id, title: wire.title ?? null };
}
