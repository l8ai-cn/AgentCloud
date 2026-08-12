"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useLightSession } from "@/hooks/useLightSession";
import { MarketplaceInstallAction } from "./MarketplaceInstallAction";

export function MarketplaceInstallButton({
  applicationSlug,
  agentSlug,
}: {
  applicationSlug: string;
  agentSlug: string;
}) {
  const t = useTranslations("marketplace");
  const router = useRouter();
  const { session, hydrated } = useLightSession();

  if (!hydrated) {
    return (
      <Button className="w-full gap-2" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("checkingAccount")}
      </Button>
    );
  }

  if (!session?.isAuthenticated) {
    return (
      <Button
        className="w-full gap-2"
        onClick={() => router.push("/login?redirect=%2Fmarketplace")}
      >
        {t("signInToEnable")}
        <ArrowRight className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <MarketplaceInstallAction
      applicationSlug={applicationSlug}
      agentSlug={agentSlug}
      orgSlug={session.currentOrgSlug}
      onInstalled={(orgSlug, expertSlug, alreadyInstalled) => {
        toast.success(alreadyInstalled ? t("alreadyInstalled") : t("installed"));
        router.push(`/${orgSlug}/experts/${expertSlug}`);
      }}
      onNeedsOrganization={() => router.push("/onboarding/create-org")}
      onConfigureResources={(orgSlug) =>
        router.push(`/${orgSlug}/settings?tab=ai-resources`)
      }
    />
  );
}
