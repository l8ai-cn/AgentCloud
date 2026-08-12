import { ApplicationExpertRedirect } from "@/components/applications/ApplicationExpertRedirect";

export default async function ApplicationFirstRunRoute({
  params,
}: {
  params: Promise<{ org: string; installationId: string }>;
}) {
  const { org, installationId } = await params;
  return <ApplicationExpertRedirect orgSlug={org} installationID={installationId} />;
}
