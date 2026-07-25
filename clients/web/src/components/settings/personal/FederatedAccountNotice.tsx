"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { getAmpAccountUrl } from "@/lib/federated-identity";

export function FederatedAccountNotice() {
  const t = useTranslations();
  const accountUrl = getAmpAccountUrl();

  return (
    <div className="surface-card border border-[var(--expert-action)]/30 bg-[var(--expert-action)]/5 p-6">
      <h2 className="text-lg font-semibold">
        {t("settings.personal.general.federatedTitle")}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("settings.personal.general.federatedDescription")}
      </p>
      <a
        href={accountUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        {t("settings.personal.general.openIdpAccount")}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
