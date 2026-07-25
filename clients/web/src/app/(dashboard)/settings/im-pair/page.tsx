"use client";

import { useTranslations } from "next-intl";
import { IMPairingSettings } from "@/components/settings/personal/IMPairingSettings";

export default function IMPairSettingsPage() {
  const t = useTranslations();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settings.personal.imPair.pageTitle")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("settings.personal.imPair.pageDescription")}
        </p>
      </div>
      <IMPairingSettings />
    </div>
  );
}
