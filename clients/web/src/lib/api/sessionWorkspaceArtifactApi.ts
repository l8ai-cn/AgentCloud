import { getApiBaseUrl } from "@/lib/env";
import { authenticatedOrganizationFetch } from "./authenticatedRequest";

export async function loadSessionArtifactRepresentation(
  input: {
    artifactId: string;
    digest: string;
    representationId: string;
    resourceId: string;
    revision: bigint;
    sessionId: string;
  },
): Promise<Blob> {
  requireSessionFileResource(input.resourceId);
  if (!input.artifactId || !input.representationId || !input.digest) {
    throw new Error("artifact_identity_missing");
  }
  const base = getApiBaseUrl().replace(/\/$/, "");
  const query = new URLSearchParams({
    artifact_id: input.artifactId,
    digest: input.digest,
    representation_id: input.representationId,
    revision: input.revision.toString(),
  });
  const response = await authenticatedOrganizationFetch(
    `${base}/v1/sessions/${encodeURIComponent(input.sessionId)}` +
      `/artifacts/content?${query.toString()}`,
  );
  return response.blob();
}

function requireSessionFileResource(resourceId: string): void {
  const fileID = resourceId.startsWith("session-file:")
    ? resourceId.slice("session-file:".length)
    : "";
  if (!fileID) {
    throw new Error(`artifact_resource_unsupported:${resourceId}`);
  }
}
