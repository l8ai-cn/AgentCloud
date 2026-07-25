import { readCurrentOrg } from "@/stores/auth";

export function imChannelsBasePath(): string {
  const slug = readCurrentOrg()?.slug ?? "";
  return `/api/v1/orgs/${slug}/im-channels`;
}
