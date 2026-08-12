"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useLightSession } from "@/hooks/useLightSession";
import {
  lightListOrganizations,
  type LightOrganization,
} from "@/lib/light-auth";
import {
  applyInstallationPlan,
  createInstallationPlan,
  fetchMarketplaceListing,
  type InstallationPlan,
  type MarketplaceListingDetail,
} from "@/lib/marketplace/acquire-api";
import { resolveExpertSlugFromRuntimeRef } from "@/lib/marketplace/expert-slug-from-installation";
import { MarketplaceAcquireConfirm } from "./MarketplaceAcquireConfirm";
import { MarketplaceAcquireHeader } from "./MarketplaceAcquireHeader";
import { OrganizationStep } from "./MarketplaceAcquireOrganizationStep";
import {
  AcquireShell,
  ErrorState,
  LoadingState,
  SuccessState,
} from "./MarketplaceAcquireStates";
import { useMarketplaceRuntimeModels } from "./useMarketplaceRuntimeModels";
import {
  marketplaceAcquireErrorMessage,
  numericToolModelIDs,
  type MarketplaceAcquireStep,
} from "./marketplaceAcquireValues";

export function MarketplaceAcquireFlow({
  organizationSlug,
}: {
  organizationSlug?: string;
}) {
  const t = useTranslations("marketplace");
  const router = useRouter();
  const params = useSearchParams();
  const { session, hydrated } = useLightSession();
  const marketSlug = params.get("market") ?? "";
  const listingSlug = params.get("listing") ?? "";
  const requestedVersion = params.get("version") ?? "";
  const [listing, setListing] = useState<MarketplaceListingDetail | null>(null);
  const [organizations, setOrganizations] = useState<LightOrganization[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [organizationID, setOrganizationID] = useState("");
  const [plan, setPlan] = useState<InstallationPlan | null>(null);
  const [expertSlug, setExpertSlug] = useState("");
  const [step, setStep] = useState<MarketplaceAcquireStep>("select");
  const [error, setError] = useState("");
  const selectedOrganization = organizations.find((item) => String(item.id) === organizationID);
  const runtimeModels = useMarketplaceRuntimeModels(
    selectedOrganization?.slug,
    listing?.agent_slug,
  );

  useEffect(() => {
    if (!marketSlug || !listingSlug) {
      setError(t("acquire.incompleteLink"));
      return;
    }
    fetchMarketplaceListing(marketSlug, listingSlug)
      .then(setListing)
      .catch((cause) => setError(marketplaceAcquireErrorMessage(cause, t("installFailed"))));
  }, [listingSlug, marketSlug, t]);

  useEffect(() => {
    if (!hydrated || !session?.isAuthenticated) return;
    setLoadingOrganizations(true);
    lightListOrganizations()
      .then(setOrganizations)
      .catch(() => setError(t("acquire.orgsLoadFailed")))
      .finally(() => setLoadingOrganizations(false));
  }, [hydrated, session?.isAuthenticated, t]);

  useEffect(() => {
    if (!organizationSlug || organizations.length === 0) return;
    const organization = organizations.find((item) => item.slug === organizationSlug);
    if (!organization) {
      setError(t("acquire.noOrgPermission"));
      return;
    }
    setOrganizationID(String(organization.id));
  }, [organizationSlug, organizations, t]);

  if (!hydrated || (!listing && !error)) {
    return <AcquireShell><LoadingState /></AcquireShell>;
  }
  if (!listing) {
    return <AcquireShell><ErrorState message={error} /></AcquireShell>;
  }
  if (!session?.isAuthenticated) {
    const redirect = organizationSlug
      ? `/${organizationSlug}/marketplace/acquire?${params.toString()}`
      : `/marketplace/acquire?${params.toString()}`;
    router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
    return <AcquireShell><LoadingState label={t("acquire.goingToLogin")} /></AcquireShell>;
  }
  if (error && step === "select") {
    return <AcquireShell><ErrorState message={error} /></AcquireShell>;
  }

  async function preparePlan() {
    if (
      !selectedOrganization ||
      !listing ||
      !runtimeModels.modelResourceID ||
      !runtimeModels.toolSelectionComplete
    ) return;
    setError("");
    try {
      const result = await createInstallationPlan(
        marketSlug,
        listingSlug,
        requestedVersion || listing.listing_version_id,
        selectedOrganization.id,
        Number(runtimeModels.modelResourceID),
        numericToolModelIDs(runtimeModels.toolModelResourceIDs),
      );
      setPlan(result);
      setStep("confirm");
    } catch (cause) {
      setError(marketplaceAcquireErrorMessage(cause, t("installFailed")));
    }
  }

  async function install() {
    if (!plan || !selectedOrganization) return;
    setStep("installing");
    setError("");
    try {
      const result = await applyInstallationPlan(plan);
      if (result.status !== "succeeded") {
        throw new Error(t("acquire.applyIncomplete"));
      }
      const slug = await resolveExpertSlugFromRuntimeRef(
        selectedOrganization.slug,
        result.runtime_ref,
      );
      setExpertSlug(slug ?? "");
      setStep("success");
    } catch (cause) {
      setStep("confirm");
      setError(marketplaceAcquireErrorMessage(cause, t("installFailed")));
    }
  }

  return (
    <AcquireShell>
      <MarketplaceAcquireHeader listing={listing} organizationSlug={organizationSlug} />
      {step === "select" ? (
        <OrganizationStep
          organizations={organizations}
          loadingOrganizations={loadingOrganizations}
          value={organizationID}
          onChange={setOrganizationID}
          onContinue={preparePlan}
          fixedOrganization={organizationSlug ? selectedOrganization : undefined}
          modelResources={runtimeModels.modelResources}
          modelResourceID={runtimeModels.modelResourceID}
          onModelChange={runtimeModels.setModelResourceID}
          toolModelGroups={runtimeModels.toolModelGroups}
          toolModelResourceIDs={runtimeModels.toolModelResourceIDs}
          onToolModelChange={runtimeModels.setToolModelResourceID}
          toolSelectionComplete={runtimeModels.toolSelectionComplete}
          missingCompatibleResource={runtimeModels.missingCompatibleResource}
          loadingModels={runtimeModels.loadingModels}
          modelError={runtimeModels.modelError}
          incompatibleListing={runtimeModels.incompatibleListing}
          onReloadModels={runtimeModels.reloadModels}
          settingsHref={
            selectedOrganization
              ? `/${selectedOrganization.slug}/settings?tab=ai-resources`
              : ""
          }
        />
      ) : null}
      {step === "confirm" && plan && selectedOrganization ? (
        <MarketplaceAcquireConfirm
          listing={listing}
          organizationName={selectedOrganization.name}
          plan={plan}
          error={error}
          onInstall={install}
        />
      ) : null}
      {step === "installing" ? <LoadingState label={t("acquire.creatingInstance")} /> : null}
      {step === "success" && selectedOrganization ? (
        <SuccessState organization={selectedOrganization} expertSlug={expertSlug} />
      ) : null}
    </AcquireShell>
  );
}
