import { getApiBaseUrl } from "@/lib/env";
import {
  authenticatedOrganizationFetch,
  requireCurrentOrganizationSlug,
} from "./authenticatedRequest";

export async function deleteTerminalPod(podKey: string): Promise<void> {
  const orgSlug = requireCurrentOrganizationSlug();
  const base = getApiBaseUrl().replace(/\/$/, "");
  await authenticatedOrganizationFetch(
    `${base}/v1/orgs/${encodeURIComponent(orgSlug)}/pods/${encodeURIComponent(podKey)}`,
    { method: "DELETE" },
  );
}
