import { lightFetch } from "@/lib/light-auth";
import {
  expertIDFromRuntimeRef,
  fetchOrganizationApplications,
} from "./application-api";

export async function resolveExpertSlugFromRuntimeRef(
  orgSlug: string,
  runtimeRef: string | undefined,
): Promise<string | undefined> {
  const expertID = expertIDFromRuntimeRef(runtimeRef ?? "");
  if (!expertID) return undefined;
  const result = await lightFetch<{ experts: Array<{ id: number; slug: string }> }>(
    `/api/v1/orgs/${encodeURIComponent(orgSlug)}/experts`,
    { authenticated: true, query: { limit: 200, offset: 0 } },
  );
  return result?.experts.find((expert) => expert.id === expertID)?.slug;
}

export async function resolveExpertSlugFromInstallation(
  orgSlug: string,
  organizationID: number,
  installationID: string,
): Promise<string | undefined> {
  const applications = await fetchOrganizationApplications(organizationID);
  const application = applications.find(
    (item) => item.installation_id === installationID,
  );
  if (!application) return undefined;
  return resolveExpertSlugFromRuntimeRef(orgSlug, application.runtime_ref);
}
