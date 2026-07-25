"use client";

import { useTranslations } from "next-intl";
import { PersonalGeneralSettings } from "@/components/settings";

export default function GeneralSettingsPage() {
  const t = useTranslations();

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          {t("settings.personal.general.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("settings.personal.general.description")}
        </p>
      </div>
      <PersonalGeneralSettings />
    </div>
  );
}
