import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type {
  InstallationPlan,
  MarketplaceListingDetail,
} from "@/lib/marketplace/acquire-api";
import { MarketplaceAcquireSummary } from "./MarketplaceAcquireSummary";
import { InlineError } from "./MarketplaceAcquireStates";

export function MarketplaceAcquireConfirm({
  listing,
  organizationName,
  plan,
  error,
  onInstall,
}: {
  listing: MarketplaceListingDetail;
  organizationName: string;
  plan: InstallationPlan;
  error: string;
  onInstall: () => void;
}) {
  const t = useTranslations("marketplace");
  return (
    <div className="space-y-6">
      <MarketplaceAcquireSummary
        listing={listing}
        organizationName={organizationName}
        plan={plan}
      />
      {error ? <InlineError message={error} /> : null}
      <Button className="w-full gap-2" size="lg" onClick={onInstall}>
        {t("acquire.confirmAndEnable")}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
