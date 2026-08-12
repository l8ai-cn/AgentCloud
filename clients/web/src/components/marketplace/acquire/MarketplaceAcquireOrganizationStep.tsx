import Link from "next/link";
import { Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { LightOrganization } from "@/lib/light-auth";
import type { MarketplaceModelResource } from "@/lib/marketplace-model-resources";
import type { MarketplaceToolModelGroup } from "@/lib/marketplace-tool-model-resources";
import { MarketplaceToolModelFields } from "../MarketplaceToolModelFields";
import { MarketplaceModelResourceField } from "./MarketplaceModelResourceField";
import { ErrorState, LoadingState } from "./MarketplaceAcquireStates";

export function OrganizationStep({
  organizations,
  loadingOrganizations,
  value,
  onChange,
  onContinue,
  fixedOrganization,
  modelResources,
  modelResourceID,
  onModelChange,
  toolModelGroups = [],
  toolModelResourceIDs = {},
  onToolModelChange = () => {},
  toolSelectionComplete = true,
  missingCompatibleResource = false,
  loadingModels,
  modelError,
  incompatibleListing,
  onReloadModels,
  settingsHref,
}: {
  organizations: LightOrganization[];
  loadingOrganizations: boolean;
  value: string;
  onChange: (value: string) => void;
  onContinue: () => void;
  fixedOrganization?: LightOrganization;
  modelResources: MarketplaceModelResource[];
  modelResourceID: string;
  onModelChange: (value: string) => void;
  toolModelGroups?: MarketplaceToolModelGroup[];
  toolModelResourceIDs?: Record<string, string>;
  onToolModelChange?: (role: string, value: string) => void;
  toolSelectionComplete?: boolean;
  missingCompatibleResource?: boolean;
  loadingModels: boolean;
  modelError: boolean;
  incompatibleListing: boolean;
  onReloadModels: () => void;
  settingsHref: string;
}) {
  const t = useTranslations("marketplace");
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {fixedOrganization ? t("acquire.checkConditionsTitleFixed") : t("acquire.checkConditionsTitle")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {fixedOrganization
            ? t("acquire.installToNamedOrg", { name: fixedOrganization.name })
            : t("acquire.installToOrg")}
        </p>
      </div>
      {loadingOrganizations ? (
        <LoadingState label={t("acquire.loadingOrgs")} />
      ) : fixedOrganization ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
          {t("acquire.enableTarget", { name: fixedOrganization.name })}
        </div>
      ) : organizations.length === 0 ? (
        <ErrorState message={t("acquire.noOrganizations")} />
      ) : (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          aria-label={t("acquire.selectOrganizationAria")}
        >
          <option value="">{t("acquire.selectOrganizationPlaceholder")}</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      )}
      {value ? (
        <div className="space-y-4">
          <MarketplaceModelResourceField
            resources={modelResources}
            value={modelResourceID}
            onChange={onModelChange}
            loading={loadingModels}
            error={modelError}
            incompatibleListing={incompatibleListing}
            onReload={onReloadModels}
            settingsHref={settingsHref}
          />
          {!loadingModels && !missingCompatibleResource ? (
            <MarketplaceToolModelFields
              groups={toolModelGroups}
              values={toolModelResourceIDs}
              onChange={onToolModelChange}
            />
          ) : null}
          {!loadingModels && missingCompatibleResource && modelResources.length > 0 ? (
            <Button asChild className="w-full gap-2" variant="outline">
              <Link href={settingsHref}>
                <Settings2 className="h-4 w-4" />
                {t("configureCompatibleToolModel")}
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
      <Button
        className="w-full"
        size="lg"
        disabled={
          !value ||
          !modelResourceID ||
          !toolSelectionComplete ||
          loadingModels ||
          missingCompatibleResource
        }
        onClick={onContinue}
      >
        {t("acquire.checkConditions")}
      </Button>
    </section>
  );
}
