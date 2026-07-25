"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Divider } from "./Divider";

interface PreferredSsoEntryProps {
  authUrl: string;
  providerName?: string;
}

export function PreferredSsoEntry({
  authUrl,
  providerName = "AMP",
}: PreferredSsoEntryProps) {
  const t = useTranslations();
  return (
    <div className="space-y-4 mb-4">
      <Button type="button" className="w-full" onClick={() => window.location.assign(authUrl)}>
        {t("auth.sso.signInWith", { name: providerName })}
      </Button>
      <Divider text={t("auth.sso.orUsePassword")} />
    </div>
  );
}
