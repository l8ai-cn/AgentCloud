"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { CenteredSpinner } from "@/components/ui/spinner";
import { resolveExpertSlugFromInstallation } from "@/lib/marketplace/expert-slug-from-installation";
import { useCurrentOrg } from "@/stores/auth";

export function ApplicationExpertRedirect({
  orgSlug,
  installationID,
}: {
  orgSlug: string;
  installationID: string;
}) {
  const router = useRouter();
  const currentOrg = useCurrentOrg();

  useEffect(() => {
    if (!currentOrg || currentOrg.slug !== orgSlug) return;
    let active = true;
    resolveExpertSlugFromInstallation(orgSlug, currentOrg.id, installationID)
      .then((slug) => {
        if (!active) return;
        router.replace(slug ? `/${orgSlug}/experts/${slug}` : `/${orgSlug}/experts`);
      })
      .catch(() => {
        if (active) router.replace(`/${orgSlug}/experts`);
      });
    return () => {
      active = false;
    };
  }, [currentOrg, installationID, orgSlug, router]);

  return <CenteredSpinner className="h-full" />;
}
